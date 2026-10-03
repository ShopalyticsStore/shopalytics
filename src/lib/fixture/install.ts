/**
 * Installs the generated dataset into one database.
 *
 * Base and candidate runtimes run this against their own database and must end
 * up with the same manifest identity, so installation regenerates the dataset,
 * compares its manifest against the committed one, writes the rows, and then
 * verifies the row counts it actually stored. A mismatch throws; it is never
 * reported as a successful seed.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Client } from "pg";

import { quoteSchema, type SeedTarget } from "../server/database-config";
import type { DudulemonDataset } from "./dataset";
import { generateDudulemonDataset } from "./dataset";
import { assertFixtureInvariants } from "./invariants";
import {
  FIXTURE_TABLE_NAMES,
  MANIFEST_RELATIVE_PATH,
  assertManifestsMatch,
  buildManifest,
  parseManifest,
  type FixtureManifest,
  type FixtureTableName,
} from "./manifest";

/** Rows per multi-row insert. Large enough to be fast, small enough to stay under parameter limits. */
const INSERT_BATCH_SIZE = 4_000;

type ColumnSpec = Readonly<{ name: string; pgType: string }>;

function columns(spec: readonly [string, string][]): readonly ColumnSpec[] {
  return spec.map(([name, pgType]) => ({ name, pgType }));
}

const TABLE_COLUMNS: Readonly<Record<FixtureTableName, readonly ColumnSpec[]>> = Object.freeze({
  accounts: columns([
    ["id", "uuid"],
    ["name", "text"],
    ["created_at", "timestamptz"],
  ]),
  users: columns([
    ["id", "uuid"],
    ["account_id", "uuid"],
    ["name", "text"],
    ["email", "text"],
    ["role", "text"],
    ["created_at", "timestamptz"],
  ]),
  products: columns([
    ["id", "uuid"],
    ["account_id", "uuid"],
    ["name", "text"],
  ]),
  traffic_sources: columns([
    ["id", "uuid"],
    ["name", "text"],
  ]),
  demographic_segments: columns([
    ["id", "uuid"],
    ["name", "text"],
  ]),
  review_topics: columns([
    ["id", "uuid"],
    ["name", "text"],
  ]),
  conversion_states: columns([
    ["id", "uuid"],
    ["key", "text"],
    ["name", "text"],
    ["ordinal", "integer"],
  ]),
  conversion_daily_metrics: columns([
    ["id", "uuid"],
    ["account_id", "uuid"],
    ["product_id", "uuid"],
    ["traffic_source_id", "uuid"],
    ["demographic_segment_id", "uuid"],
    ["conversion_state_id", "uuid"],
    ["date", "date"],
    ["sessions", "integer"],
    ["product_views", "integer"],
    ["add_to_carts", "integer"],
    ["checkouts", "integer"],
    ["purchases", "integer"],
    ["revenue_cents", "bigint"],
  ]),
  customer_reviews: columns([
    ["id", "uuid"],
    ["account_id", "uuid"],
    ["product_id", "uuid"],
    ["traffic_source_id", "uuid"],
    ["demographic_segment_id", "uuid"],
    ["date", "date"],
    ["rating", "smallint"],
    ["sentiment", "text"],
    ["body", "text"],
    ["reviewer_name", "text"],
    ["reviewer_email", "text"],
    ["reviewer_location", "text"],
  ]),
  customer_review_topics: columns([
    ["review_id", "uuid"],
    ["topic_id", "uuid"],
  ]),
});

export type InstalledFixture = Readonly<{
  target: SeedTarget;
  schema: string;
  manifest: FixtureManifest;
  insertedRows: Readonly<Record<FixtureTableName, number>>;
}>;

/** Reads and validates the committed manifest. */
export async function readCommittedManifest(): Promise<FixtureManifest> {
  const document = await readFile(resolve(MANIFEST_RELATIVE_PATH), "utf8");
  return parseManifest(document);
}

async function insertTable(
  client: Client,
  table: FixtureTableName,
  rows: readonly Readonly<Record<string, unknown>>[],
): Promise<number> {
  const spec = TABLE_COLUMNS[table];
  const columnList = spec.map((column) => column.name).join(", ");
  const unnestArguments = spec
    .map((column, index) => `$${index + 1}::${column.pgType}[]`)
    .join(", ");
  const statement = `INSERT INTO ${table} (${columnList}) SELECT * FROM unnest(${unnestArguments})`;

  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const values = spec.map((column) => batch.map((row) => row[column.name] ?? null));
    const result = await client.query(statement, values);
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function verifyRowCounts(client: Client, manifest: FixtureManifest): Promise<void> {
  const mismatches: string[] = [];
  for (const table of manifest.tables) {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${table.name}`,
    );
    const stored = Number(result.rows[0]?.count ?? "-1");
    if (stored !== table.row_count) {
      mismatches.push(`${table.name}: manifest says ${table.row_count}, database holds ${stored}`);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`seeded row counts do not match the manifest: ${mismatches.join("; ")}`);
  }
}

export type InstallOptions = Readonly<{
  client: Client;
  schema: string;
  target: SeedTarget;
  schemaSql: string;
}>;

/**
 * Applies the schema and installs the fixture in one transaction.
 *
 * `schemaSql` is the contents of `db/schema.sql`; the caller reads it so this
 * function stays usable from tests that pin a different path.
 */
export async function installFixture(options: InstallOptions): Promise<InstalledFixture> {
  const committed = await readCommittedManifest();
  const dataset: DudulemonDataset = generateDudulemonDataset();
  assertFixtureInvariants(dataset);
  const manifest = buildManifest(dataset);
  assertManifestsMatch(committed, manifest);

  const { client, schema, target } = options;
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteSchema(schema)}`);
  await client.query(`SET search_path TO ${quoteSchema(schema)}`);
  await client.query("BEGIN");
  try {
    await client.query(options.schemaSql);

    const insertedRows: Record<FixtureTableName, number> = {
      accounts: 0,
      users: 0,
      products: 0,
      traffic_sources: 0,
      demographic_segments: 0,
      review_topics: 0,
      conversion_states: 0,
      conversion_daily_metrics: 0,
      customer_reviews: 0,
      customer_review_topics: 0,
    };
    for (const table of FIXTURE_TABLE_NAMES) {
      const rows = dataset[table] as readonly Readonly<Record<string, unknown>>[];
      insertedRows[table] = await insertTable(client, table, rows);
    }

    await client.query(
      `INSERT INTO fixture_manifest (
         fixture_id, schema_version, content_hash, fixture_clock,
         environment_template_id, environment_template_revision, seed_target, document
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        manifest.fixture_id,
        manifest.schema_version,
        manifest.content_hash,
        manifest.fixture_clock,
        manifest.environment_template.id,
        manifest.environment_template.revision,
        target,
        JSON.stringify(manifest),
      ],
    );

    await verifyRowCounts(client, manifest);
    await client.query("COMMIT");
    return Object.freeze({ target, schema, manifest, insertedRows });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
