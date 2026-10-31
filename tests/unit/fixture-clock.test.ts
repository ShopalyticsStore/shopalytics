import { describe, expect, test, vi } from "vitest";
import { resolveSavedView, savedViewFiltersSchema, type SavedView } from "@/lib/db/saved-views";
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

const saved: SavedView = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Weekly review",
  datePreset: "last_30_days",
  filters: {
    productIds: ["11111111-1111-4111-8111-111111111111"],
    trafficSourceIds: ["22222222-2222-4222-8222-222222222222"],
    demographicSegmentIds: ["33333333-3333-4333-8333-333333333333"],
    reviewTopicIds: ["44444444-4444-4444-8444-444444444444"],
    conversionStateIds: ["55555555-5555-4555-8555-555555555555"],
    sentiments: ["negative"],
    startDate: "2026-08-16",
    endDate: "2026-09-14",
  },
};

describe("saved personal views", () => {
  test("reopens relative dates against the current clock and preserves every other filter", () => {
    const restored = resolveSavedView(saved, new Date("2026-10-14T09:00:00Z"));
    expect(restored).toEqual({ ...saved.filters, startDate: "2026-09-15", endDate: "2026-10-14" });
    expect(savedViewFiltersSchema.safeParse(restored).success).toBe(true);
    expect(resolveSavedView({ ...saved, datePreset: "custom" }, new Date())).toEqual(saved.filters);
  });

  test("persists the complete payload with server-supplied ownership and reads only that owner", async () => {
    const query = vi.mocked(queryRows);
    query.mockResolvedValueOnce([saved]).mockResolvedValueOnce([saved]);
    expect(await saveView("account-a", "user-a", saved)).toEqual(saved);
    const [insert, values] = query.mock.calls[0]!;
    expect(insert).toContain("INSERT INTO saved_conversion_views");
    expect(values.slice(1)).toEqual([
      "account-a",
      "user-a",
      saved.name,
      JSON.stringify(saved.filters),
      saved.datePreset,
    ]);
    expect(await getSavedViews("account-a", "user-a")).toEqual([saved]);
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining("WHERE account_id = $1::uuid AND user_id = $2::uuid"),
      ["account-a", "user-a"],
    ]);
    query.mockResolvedValueOnce([]);
    expect(await getSavedViews("account-a", "user-b")).toEqual([]);
    expect(query.mock.calls[2]?.[1]).toEqual(["account-a", "user-b"]);
    query.mockResolvedValueOnce([]);
    expect(await getSavedViews("account-b", "user-a")).toEqual([]);
    expect(query.mock.calls[3]?.[1]).toEqual(["account-b", "user-a"]);
  });
});

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
