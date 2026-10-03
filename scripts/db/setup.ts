/**
 * Installs the Dudulemon fixture into one runtime database.
 *
 * Usage:
 *   npm run db:seed:base        seed the base preview runtime
 *   npm run db:seed:candidate   seed a candidate preview runtime
 *
 * Both targets install the same manifest identity into a different named
 * database, which is what lets uTrace claim that a candidate runtime holds the
 * approved dataset the base demonstration used.
 *
 * Environment:
 *   SHOPALYTICS_BASE_DATABASE_URL       base target connection string
 *   SHOPALYTICS_CANDIDATE_DATABASE_URL  candidate target connection string
 *   SHOPALYTICS_DATABASE_SCHEMA         schema that owns the fixture tables
 *   DATABASE_SSL                        "true" (default) or "false"
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

import { installFixture } from "../../src/lib/fixture/install";
import { resolveSeedDatabaseConfig, type SeedTarget } from "../../src/lib/server/database-config";

const SEED_TARGETS: readonly SeedTarget[] = ["base", "candidate"];

function parseTarget(argument: string | undefined): SeedTarget {
  if (argument === undefined) {
    throw new Error(`a seed target is required, one of: ${SEED_TARGETS.join(", ")}`);
  }
  const target = SEED_TARGETS.find((candidate) => candidate === argument);
  if (target === undefined) {
    throw new Error(
      `unknown seed target "${argument}", expected one of: ${SEED_TARGETS.join(", ")}`,
    );
  }
  return target;
}

async function main(): Promise<void> {
  const target = parseTarget(process.argv[2]);
  const config = resolveSeedDatabaseConfig(process.env, target);
  const schemaSql = await readFile(resolve("db/schema.sql"), "utf8");

  const client = new pg.Client({ connectionString: config.connectionString, ssl: config.ssl });
  await client.connect();
  const startedAt = Date.now();
  try {
    const installed = await installFixture({
      client,
      schema: config.schema,
      target,
      schemaSql,
    });

    console.log(`seeded the ${target} runtime in schema "${installed.schema}"`);
    console.log(`  manifest hash   ${installed.manifest.content_hash}`);
    console.log(`  fixture clock   ${installed.manifest.fixture_clock}`);
    console.log(`  growth lead     ${installed.manifest.identity.growth_lead.email}`);
    for (const table of installed.manifest.tables) {
      console.log(`  ${table.name.padEnd(26)} ${String(table.row_count).padStart(7)} rows`);
    }
    console.log(`  completed in    ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  } finally {
    await client.end();
  }
}

await main();
