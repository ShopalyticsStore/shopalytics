/**
 * The seed manifest.
 *
 * `fixtures/dudulemon/manifest.json` is the fixture's identity: per-table
 * content hashes, the pinned fixture clock, the Vercel Sandbox runtime template the
 * dataset is prepared for, and the authenticated Dudulemon growth lead. uTrace
 * cites this identity when it claims that a candidate runtime holds the same
 * approved dataset as the base runtime, so seeding recomputes the hashes and
 * refuses to install a dataset that does not reproduce them.
 *
 * The manifest contains no timestamps and no environment-dependent values, so
 * regenerating it is byte-identical.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  ENVIRONMENT_TEMPLATE,
  FIXTURE_CLOCK,
  FIXTURE_HISTORY_DAYS,
  FIXTURE_ID,
  FIXTURE_ROOT_SEED,
} from "./definition";
import type { DudulemonDataset } from "./dataset";

export const MANIFEST_SCHEMA_VERSION = "shopalytics-fixture-manifest-v1";

/** Path of the committed manifest, relative to the repository root. */
export const MANIFEST_RELATIVE_PATH = "fixtures/dudulemon/manifest.json";

/** Seeding order: parents before children. Also the manifest's table order. */
export const FIXTURE_TABLE_NAMES = Object.freeze([
  "accounts",
  "users",
  "products",
  "traffic_sources",
  "demographic_segments",
  "review_topics",
  "conversion_states",
  "conversion_daily_metrics",
  "customer_reviews",
  "customer_review_topics",
] as const);

export type FixtureTableName = (typeof FIXTURE_TABLE_NAMES)[number];

const tableManifestSchema = z
  .object({
    name: z.string().min(1),
    row_count: z.number().int().nonnegative(),
    content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  })
  .strict();

const manifestSchema = z
  .object({
    schema_version: z.literal(MANIFEST_SCHEMA_VERSION),
    fixture_id: z.string().min(1),
    root_seed: z.string().min(1),
    fixture_clock: z.string().min(1),
    history_days: z.number().int().positive(),
    environment_template: z
      .object({
        id: z.string().min(1),
        revision: z.number().int().positive(),
        dockerfile: z.string().min(1),
        supervisor: z.string().min(1),
        application_port: z.number().int().positive(),
        postgres_major_version: z.number().int().positive(),
        node_major_version: z.number().int().positive(),
      })
      .strict(),
    identity: z
      .object({
        account: z.object({ id: z.string().uuid(), name: z.string().min(1) }).strict(),
        growth_lead: z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1),
            email: z.string().email(),
            role: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
    tables: z.array(tableManifestSchema).min(1),
    content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  })
  .strict();

export type FixtureManifest = z.infer<typeof manifestSchema>;
export type FixtureTableManifest = z.infer<typeof tableManifestSchema>;

type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { [key: string]: JsonValue };

/** JSON with object keys in sorted order, so hashing does not depend on insertion order. */
function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as { [key: string]: JsonValue };
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key]!)}`);
  return `{${entries.join(",")}}`;
}

/** Content hash of one table: sha256 over its canonical rows in seeding order. */
export function hashTable(rows: readonly Readonly<Record<string, unknown>>[]): string {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(canonicalJson(row as JsonValue));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

function tableRows(
  dataset: DudulemonDataset,
  table: FixtureTableName,
): readonly Readonly<Record<string, unknown>>[] {
  return dataset[table] as readonly Readonly<Record<string, unknown>>[];
}

/** Derives the manifest from a generated dataset. */
export function buildManifest(dataset: DudulemonDataset): FixtureManifest {
  const account = dataset.accounts[0];
  const growthLead = dataset.users[0];
  if (account === undefined || growthLead === undefined) {
    throw new Error("the dataset must contain the Dudulemon account and its growth lead");
  }

  const tables: FixtureTableManifest[] = FIXTURE_TABLE_NAMES.map((name) => {
    const rows = tableRows(dataset, name);
    return { name, row_count: rows.length, content_hash: hashTable(rows) };
  });

  const overall = createHash("sha256");
  for (const table of tables) {
    overall.update(`${table.name}:${table.row_count}:${table.content_hash}\n`);
  }

  return manifestSchema.parse({
    schema_version: MANIFEST_SCHEMA_VERSION,
    fixture_id: FIXTURE_ID,
    root_seed: FIXTURE_ROOT_SEED,
    fixture_clock: FIXTURE_CLOCK,
    history_days: FIXTURE_HISTORY_DAYS,
    environment_template: { ...ENVIRONMENT_TEMPLATE },
    identity: {
      account: { id: account.id, name: account.name },
      growth_lead: {
        id: growthLead.id,
        name: growthLead.name,
        email: growthLead.email,
        role: growthLead.role,
      },
    },
    tables,
    content_hash: `sha256:${overall.digest("hex")}`,
  });
}

/** The exact bytes written to `fixtures/dudulemon/manifest.json`. */
export function serializeManifest(manifest: FixtureManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Parses and validates a manifest document. */
export function parseManifest(document: string): FixtureManifest {
  const parsed: unknown = JSON.parse(document);
  return manifestSchema.parse(parsed);
}

/**
 * Throws unless `installed` reproduces `expected` exactly, naming the tables
 * that differ. Seeding uses this so a drifted dataset can never be presented as
 * the approved one.
 */
export function assertManifestsMatch(expected: FixtureManifest, installed: FixtureManifest): void {
  if (expected.content_hash === installed.content_hash) {
    return;
  }
  const differences = expected.tables
    .map((table) => {
      const other = installed.tables.find((candidate) => candidate.name === table.name);
      if (other === undefined) {
        return `${table.name}: missing from the regenerated dataset`;
      }
      if (other.content_hash === table.content_hash && other.row_count === table.row_count) {
        return null;
      }
      return `${table.name}: expected ${table.row_count} rows ${table.content_hash}, got ${other.row_count} rows ${other.content_hash}`;
    })
    .filter((difference): difference is string => difference !== null);

  throw new Error(
    `fixture manifest mismatch: expected ${expected.content_hash}, got ${installed.content_hash}. ` +
      `Differing tables: ${differences.length > 0 ? differences.join("; ") : "none (manifest metadata differs)"}. ` +
      `Run "npm run fixture:generate" if the fixture definition changed on purpose.`,
  );
}
