import { Pool } from "pg";
import { logger } from "../../shared/utils";

let pool: Pool | null = null;

export function initPool(uri: string): Pool {
  pool = new Pool({
    connectionString: uri,
    max: 20,
    idleTimeoutMillis: 30000,
  });

  pool.on("error", (err) =>
    logger.error("PostgreSQL pool error", { error: err.stack })
  );
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error("Pool not initialized");
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
