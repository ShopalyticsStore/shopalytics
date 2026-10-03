/**
 * Database connection configuration, shared by the running application and the
 * seeding scripts.
 *
 * The fixture never uses the `public` schema: uTrace seeds a base runtime and a
 * separate candidate runtime with the same approved dataset identity, and local
 * development shares one Postgres instance with other work. The schema is
 * therefore always explicit, and applied through `search_path` so the SQL stays
 * unqualified.
 */

export type DatabaseConfig = Readonly<{
  connectionString: string;
  schema: string;
  ssl: false | Readonly<{ rejectUnauthorized: boolean }>;
}>;

export type SeedTarget = "base" | "candidate";

export const SEED_TARGET_URL_ENV_NAMES: Readonly<Record<SeedTarget, string>> = Object.freeze({
  base: "SHOPALYTICS_BASE_DATABASE_URL",
  candidate: "SHOPALYTICS_CANDIDATE_DATABASE_URL",
});

export const DATABASE_SCHEMA_ENV_NAME = "SHOPALYTICS_DATABASE_SCHEMA";

/** Postgres rejects an unquoted identifier outside this shape. */
const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/u;

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required but is not set.`);
  }
  return value.trim();
}

function resolveSchema(env: NodeJS.ProcessEnv): string {
  const schema = requireEnv(env, DATABASE_SCHEMA_ENV_NAME);
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `${DATABASE_SCHEMA_ENV_NAME} must match ${SCHEMA_PATTERN.source}, received "${schema}".`,
    );
  }
  if (schema === "public") {
    throw new Error(
      `${DATABASE_SCHEMA_ENV_NAME} must not be "public": the fixture owns its own schema.`,
    );
  }
  return schema;
}

function resolveSsl(env: NodeJS.ProcessEnv): DatabaseConfig["ssl"] {
  const value = env.DATABASE_SSL;
  if (value === "false") return false;
  if (value === undefined || value === "true") return { rejectUnauthorized: false };
  throw new Error(`DATABASE_SSL must be "true" or "false", received "${value}".`);
}

/** Configuration for the running application (`DATABASE_URL`). */
export function resolveDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  return Object.freeze({
    connectionString: requireEnv(env, "DATABASE_URL"),
    schema: resolveSchema(env),
    ssl: resolveSsl(env),
  });
}

/** Configuration for one seeding target. */
export function resolveSeedDatabaseConfig(
  env: NodeJS.ProcessEnv,
  target: SeedTarget,
): DatabaseConfig {
  return Object.freeze({
    connectionString: requireEnv(env, SEED_TARGET_URL_ENV_NAMES[target]),
    schema: resolveSchema(env),
    ssl: resolveSsl(env),
  });
}

/** A quoted schema identifier, safe to interpolate into DDL. */
export function quoteSchema(schema: string): string {
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new Error(`refusing to quote an unexpected schema name "${schema}".`);
  }
  return `"${schema}"`;
}
