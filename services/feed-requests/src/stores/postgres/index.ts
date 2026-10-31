import { Pool, type PoolClient } from 'pg';
import logger from '../../utils/logger';

export type SqlExecutor = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, any>[]>;

let pool: Pool | undefined;

export function initPool(uri: string, options?: { max?: number }): Pool {
  pool = new Pool({
    connectionString: uri,
    max: options?.max,
    min: 0,
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Postgres pool has not been initialized');
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}

/**
 * Converts `?`-style positional placeholders (used by the previous ORM's raw
 * SQL interface) to Postgres `$n` placeholders. The SQL statements themselves
 * are unchanged from the pre-migration service.
 */
export function toPgPlaceholders(sql: string): string {
  let index = 0;

  return sql.replace(/\?/g, () => `$${++index}`);
}

export function createExecutor(client: Pool | PoolClient): SqlExecutor {
  return async (sql, params = []) => {
    const { rows } = await client.query(toPgPlaceholders(sql), params as any[]);

    return rows;
  };
}

export function execute(sql: string, params?: unknown[]) {
  return createExecutor(getPool())(sql, params);
}

/**
 * Runs the callback with an executor bound to a dedicated client inside a
 * transaction, committing on success and rolling back on failure.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (exec: SqlExecutor) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const exec = createExecutor(client);
    const result = await fn(exec);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Failed to rollback transaction', {
        error: (rollbackErr as Error).stack,
      });
    }

    throw err;
  } finally {
    client.release();
  }
}
