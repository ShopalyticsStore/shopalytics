/**
 * The fixture clock.
 *
 * `SHOPALYTICS_FIXTURE_CLOCK` pins what the dashboard treats as "now" so the
 * `Last 30 days` preset and the date defaults select the same rows on every
 * run of the uTrace demo. It is read on the server; the browser receives the
 * resolved value through the demo-context response (see
 * `src/lib/server/shopalytics.ts`) because Next.js only inlines `NEXT_PUBLIC_*`
 * variables at build time and the preview runtime must be able to set the clock
 * at start-up.
 *
 * Unset or empty means real time. An unparsable value is a hard failure: a demo
 * that silently falls back to wall-clock time produces evidence that cannot be
 * reproduced.
 *
 * All range arithmetic is UTC so the server and the browser agree regardless of
 * the viewer's time zone.
 */

export const FIXTURE_CLOCK_ENV_NAME = "SHOPALYTICS_FIXTURE_CLOCK";

/** RFC 3339 `date-time`, with a required offset (`Z` or `+hh:mm`). */
const RFC_3339_PATTERN = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/u;

export type DateRangePreset = "last_7_days" | "last_30_days" | "last_90_days" | "custom";

export type DateRange = Readonly<{
  /** Inclusive `yyyy-mm-dd` start. */
  startDate: string;
  /** Inclusive `yyyy-mm-dd` end. */
  endDate: string;
}>;

export const DATE_RANGE_PRESET_DAYS: Readonly<Record<Exclude<DateRangePreset, "custom">, number>> =
  Object.freeze({
    last_7_days: 7,
    last_30_days: 30,
    last_90_days: 90,
  });

export const DATE_RANGE_PRESET_LABELS: Readonly<Record<DateRangePreset, string>> = Object.freeze({
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  custom: "Custom",
});

/** Parses an RFC 3339 timestamp, throwing with the offending value. */
export function parseFixtureClock(value: string): Date {
  if (!RFC_3339_PATTERN.test(value)) {
    throw new Error(
      `${FIXTURE_CLOCK_ENV_NAME} must be an RFC 3339 timestamp with an offset, received "${value}"`,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${FIXTURE_CLOCK_ENV_NAME} is not a valid instant, received "${value}"`);
  }
  return parsed;
}

/** Resolves the configured clock, or `null` when the fixture runs on real time. */
export function resolveFixtureClock(rawValue: string | undefined): Date | null {
  if (rawValue === undefined || rawValue.trim() === "") {
    return null;
  }
  return parseFixtureClock(rawValue.trim());
}

/**
 * The instant the product should treat as "now", from the clock the server
 * reported in the dashboard context. `null` means the fixture runs on real
 * time.
 */
export function resolveDashboardNow(fixtureClock: string | null, realNow: Date): Date {
  return fixtureClock === null ? realNow : parseFixtureClock(fixtureClock);
}

/** `yyyy-mm-dd` in UTC. */
export function toUtcDateString(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** Shifts a UTC calendar date by whole days. */
export function shiftUtcDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

/**
 * The inclusive range a preset selects, ending on the clock's own UTC day.
 * `last_30_days` therefore spans the clock day and the 29 days before it.
 */
export function presetDateRange(preset: Exclude<DateRangePreset, "custom">, now: Date): DateRange {
  const days = DATE_RANGE_PRESET_DAYS[preset];
  return Object.freeze({
    startDate: toUtcDateString(shiftUtcDays(now, -(days - 1))),
    endDate: toUtcDateString(now),
  });
}

/** Identifies the preset a concrete range reproduces, or `custom`. */
export function matchDateRangePreset(range: DateRange, now: Date): DateRangePreset {
  for (const preset of ["last_7_days", "last_30_days", "last_90_days"] as const) {
    const candidate = presetDateRange(preset, now);
    if (candidate.startDate === range.startDate && candidate.endDate === range.endDate) {
      return preset;
    }
  }
  return "custom";
}
