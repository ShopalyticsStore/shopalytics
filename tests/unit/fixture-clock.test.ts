import { describe, expect, test } from "vitest";

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
