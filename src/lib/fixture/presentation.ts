/**
 * Presenting the fixture on today's date.
 *
 * The fixture is generated against its pinned clock, and that stays its identity:
 * `fixture_manifest`, its content hash and its `fixture_clock` never change. When a
 * preview runtime starts, it moves every date in the dataset forward by the same
 * whole number of days, so the clock's day reads as today and `Last 30 days` ends
 * today, and it records how far it moved them so the dashboard's "now" moves with
 * the data. The same rows stay inside and outside every preset.
 *
 * The shift counts whole days elapsed since the clock, so the moved clock is the
 * latest instant at or before now with the clock's time of day (09:00 UTC): the
 * dashboard's "now" never runs ahead of real time.
 */

import type pg from "pg";

import { parseFixtureClock, shiftUtcDays } from "./clock";

const DAY_MS = 86_400_000;

/** Whole days elapsed from the fixture clock to `now`. */
export function shiftDaysToNow(fixtureClock: Date, now: Date): number {
  return Math.floor((now.getTime() - fixtureClock.getTime()) / DAY_MS);
}

/** The fixture clock moved forward with the dataset. */
export function presentedClock(fixtureClock: Date, shiftDays: number): Date {
  return shiftUtcDays(fixtureClock, shiftDays);
}

export type PresentedFixture = Readonly<{
  /** Days moved by this call; zero when the dataset already reads as `now`. */
  movedDays: number;
  /** Days the dataset now sits after its pinned clock in all. */
  shiftDays: number;
  /** The clock the dashboard now treats as "now". */
  clock: Date;
}>;

/**
 * Moves the installed dataset by the whole days elapsed since its clock, in one
 * transaction.
 *
 * Idempotent: the shift already applied is recorded in `fixture_presentation` (no
 * row means none yet), so a restarted runtime moves the dates only by the
 * difference. The client's `search_path` must name the fixture's schema.
 */
export async function presentFixtureAt(client: pg.Client, now: Date): Promise<PresentedFixture> {
  await client.query("BEGIN");
  try {
    const manifest = await client.query<{ fixture_clock: string }>(
      "SELECT fixture_clock FROM fixture_manifest",
    );
    const installed = manifest.rows[0];
    if (installed === undefined) {
      throw new Error("no fixture is installed: fixture_manifest is empty");
    }
    const fixtureClock = parseFixtureClock(installed.fixture_clock);
    const applied = await client.query<{ shift_days: number }>(
      "SELECT shift_days FROM fixture_presentation",
    );
    const shiftDays = shiftDaysToNow(fixtureClock, now);
    const movedDays = shiftDays - (applied.rows[0]?.shift_days ?? 0);
    if (movedDays !== 0) {
      await client.query("UPDATE conversion_daily_metrics SET date = date + $1::integer", [
        movedDays,
      ]);
      await client.query("UPDATE customer_reviews SET date = date + $1::integer", [movedDays]);
      for (const table of ["accounts", "users"]) {
        await client.query(
          `UPDATE ${table} SET created_at = created_at + make_interval(days => $1::integer)`,
          [movedDays],
        );
      }
    }
    await client.query(
      `INSERT INTO fixture_presentation (id, shift_days) VALUES (true, $1)
       ON CONFLICT (id) DO UPDATE SET shift_days = EXCLUDED.shift_days`,
      [shiftDays],
    );
    await client.query("COMMIT");
    return { movedDays, shiftDays, clock: presentedClock(fixtureClock, shiftDays) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
