import { Pool, type QueryResultRow } from "pg";

import { resolveDatabaseConfig } from "./database-config";

type SqlValue = string | number | boolean | Date | null | readonly string[];

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool) return pool;

  const config = resolveDatabaseConfig(process.env);

  // `options` travels in the startup packet, so every connection resolves
  // unqualified names in the fixture's own schema from its first statement and
  // the queries themselves stay schema-agnostic.
  pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    options: `-c search_path=${config.schema}`,
  });
  return pool;
}

export async function queryRows<T extends QueryResultRow>(
  text: string,
  values: readonly SqlValue[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values as SqlValue[]);
  return result.rows;
}
