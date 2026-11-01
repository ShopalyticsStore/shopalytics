/**
 * Moves the running preview's dataset so its fixture clock's day reads as today.
 *
 * Usage:
 *   npm run db:present   the preview supervisor runs it before every start
 *
 * See `src/lib/fixture/presentation.ts`. It acts on the database the application
 * serves from (`DATABASE_URL`, `SHOPALYTICS_DATABASE_SCHEMA`).
 */

import pg from "pg";

import { toUtcDateString } from "../../src/lib/fixture/clock";
import { presentFixtureAt } from "../../src/lib/fixture/presentation";
import { resolveDatabaseConfig } from "../../src/lib/server/database-config";

async function main(): Promise<void> {
  const config = resolveDatabaseConfig(process.env);
  const client = new pg.Client({
    connectionString: config.connectionString,
    ssl: config.ssl,
    options: `-c search_path=${config.schema}`,
  });
  await client.connect();
  try {
    const presented = await presentFixtureAt(client, new Date());
    console.log(
      `moved the fixture ${presented.movedDays} days (${presented.shiftDays} after its pinned clock); ` +
        `its last day is ${toUtcDateString(presented.clock)}`,
    );
  } finally {
    await client.end();
  }
}

await main();
