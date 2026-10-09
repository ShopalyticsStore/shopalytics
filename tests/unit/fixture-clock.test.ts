import { describe, expect, test, vi } from "vitest";
import { captureView, restoreView, savedViewFiltersSchema } from "@/lib/db/saved-views";
import type { AnalyticsFilters } from "@/lib/db/types";
import { getSavedViews, saveView } from "@/lib/server/shopalytics";
import { queryRows } from "@/lib/server/db";

vi.mock("@/lib/server/db", () => ({ queryRows: vi.fn() }));

import {
  matchDateRangePreset,
  parseFixtureClock,
  presetDateRange,
  resolveDashboardNow,
  resolveFixtureClock,
  shiftUtcDays,
  toUtcDateString,
} from "@/lib/fixture/clock";
import { FIXTURE_CLOCK } from "@/lib/fixture/definition";

describe("the fixture clock", () => {
  test("accepts RFC 3339 instants with an offset", () => {
    expect(parseFixtureClock("2026-09-14T09:00:00Z").toISOString()).toBe(
      "2026-09-14T09:00:00.000Z",
    );
    expect(parseFixtureClock("2026-09-14T11:00:00+02:00").toISOString()).toBe(
      "2026-09-14T09:00:00.000Z",
    );
    expect(parseFixtureClock("2026-09-14T09:00:00.250Z").toISOString()).toBe(
      "2026-09-14T09:00:00.250Z",
    );
  });

  test("fails loudly on a value it cannot parse", () => {
    for (const value of [
      "",
      "yesterday",
      "2026-09-14",
      "2026-09-14 09:00:00",
      "2026-09-14T09:00:00",
    ]) {
      expect(() => parseFixtureClock(value)).toThrowError(/SHOPALYTICS_FIXTURE_CLOCK/u);
    }
    expect(() => parseFixtureClock("2026-13-40T09:00:00Z")).toThrowError(
      /SHOPALYTICS_FIXTURE_CLOCK/u,
    );
  });

  test("an unset clock means real time", () => {
    expect(resolveFixtureClock(undefined)).toBeNull();
    expect(resolveFixtureClock("   ")).toBeNull();
    expect(resolveFixtureClock(" 2026-09-14T09:00:00Z ")?.toISOString()).toBe(
      "2026-09-14T09:00:00.000Z",
    );
  });

  test("an unparsable clock throws instead of falling back to real time", () => {
    expect(() => resolveFixtureClock("not-a-time")).toThrowError(/SHOPALYTICS_FIXTURE_CLOCK/u);
  });

  test("Last 30 days is the clock day and the 29 days before it", () => {
    const now = parseFixtureClock(FIXTURE_CLOCK);

    expect(presetDateRange("last_30_days", now)).toEqual({
      startDate: "2026-08-16",
      endDate: "2026-09-14",
    });
    expect(presetDateRange("last_7_days", now)).toEqual({
      startDate: "2026-09-08",
      endDate: "2026-09-14",
    });
    expect(presetDateRange("last_90_days", now)).toEqual({
      startDate: "2026-06-17",
      endDate: "2026-09-14",
    });
  });

  test("a preset range is recognised again, and a hand-picked one is custom", () => {
    const now = parseFixtureClock(FIXTURE_CLOCK);

    expect(matchDateRangePreset(presetDateRange("last_30_days", now), now)).toBe("last_30_days");
    expect(matchDateRangePreset({ startDate: "2026-08-17", endDate: "2026-09-14" }, now)).toBe(
      "custom",
    );
  });

  test("the dashboard uses the reported clock, or real time when there is none", () => {
    const realNow = new Date("2030-01-01T00:00:00Z");

    expect(resolveDashboardNow(FIXTURE_CLOCK, realNow).toISOString()).toBe(
      "2026-09-14T09:00:00.000Z",
    );
    expect(resolveDashboardNow(null, realNow)).toBe(realNow);
  });

  test("day arithmetic stays in UTC", () => {
    const now = parseFixtureClock(FIXTURE_CLOCK);

    expect(toUtcDateString(shiftUtcDays(now, -1))).toBe("2026-09-13");
    expect(toUtcDateString(shiftUtcDays(now, 1))).toBe("2026-09-15");
  });
});

describe("saved conversion views", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const filters: AnalyticsFilters = {
    productIds: [id],
    trafficSourceIds: [id],
    demographicSegmentIds: [id],
    sentiments: ["negative", "neutral"],
    reviewTopicIds: [id],
    conversionStateIds: [id],
    ...presetDateRange("last_30_days", new Date(FIXTURE_CLOCK)),
  };

  test("restores every filter after a JSON persistence round trip", () => {
    const saved = savedViewFiltersSchema.parse(
      JSON.parse(JSON.stringify(captureView(filters, "custom"))),
    );
    expect(restoreView(saved, new Date("2030-01-01T00:00:00Z"))).toEqual(filters);
    expect(Object.keys(restoreView(saved, new Date())).sort()).toEqual(Object.keys(filters).sort());
  });

  test.each(["last_7_days", "last_30_days", "last_90_days"] as const)(
    "keeps %s relative when reopened later",
    (preset) => {
      const saved = savedViewFiltersSchema.parse(
        JSON.parse(JSON.stringify(captureView(filters, preset))),
      );
      expect(saved.dateRange).toEqual({ preset });
      const later = new Date("2030-01-01T00:00:00Z");
      expect(restoreView(saved, later)).toEqual({ ...filters, ...presetDateRange(preset, later) });
    },
  );

  test("rejects owner identifiers and unknown filter fields", () => {
    expect(
      savedViewFiltersSchema.safeParse({ ...captureView(filters, "custom"), accountId: id })
        .success,
    ).toBe(false);
  });

  test("persists the complete view and scopes retrieval to both server owner identifiers", async () => {
    const saved = captureView(filters, "last_30_days");
    const view = { id, name: "Weekly conversion", filters: saved };
    const query = vi.mocked(queryRows);
    query.mockResolvedValueOnce([view]);
    expect(await saveView("account", "user", view.name, saved)).toEqual(view);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO saved_views"), [
      expect.any(String),
      "account",
      "user",
      view.name,
      JSON.stringify(saved),
    ]);
    query.mockResolvedValueOnce([view]);
    expect(await getSavedViews("account", "user")).toEqual([view]);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("WHERE account_id = $1::uuid AND user_id = $2::uuid"),
      ["account", "user"],
    );
    query.mockResolvedValueOnce([]);
    expect(await getSavedViews("account", "other-user")).toEqual([]);
    expect(query).toHaveBeenLastCalledWith(expect.any(String), ["account", "other-user"]);
    query.mockResolvedValueOnce([]);
    expect(await getSavedViews("other-account", "user")).toEqual([]);
    expect(query).toHaveBeenLastCalledWith(expect.any(String), ["other-account", "user"]);
  });
});
