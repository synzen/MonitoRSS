import { Client, Pool } from 'pg';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { loadConfig } from '../../config';
import { runMigrationsUp } from './migrations';
import pruneAndCreatePartitions from '../../utils/prune-and-create-partitions';

dayjs.extend(utc);

// Cloned per test file via CREATE DATABASE ... TEMPLATE, so every file starts
// from the exact schema the migrations produce. Prepared once per test run by
// src/test/helpers/prepare-template-db.ts.
const TEMPLATE_DB_NAME = 'feedrequests_template';

function getAdminUri(): string {
  const url = new URL(loadConfig().FEED_REQUESTS_POSTGRES_URI);
  url.pathname = '/postgres';

  return url.toString();
}

function getDatabaseUri(dbName: string): string {
  const url = new URL(loadConfig().FEED_REQUESTS_POSTGRES_URI);
  url.pathname = `/${dbName}`;

  return url.toString();
}

async function withAdminClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: getAdminUri() });

  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Runs the real migration runner against a fresh template database. Called
 * once per test run, before the test files spawn.
 */
export async function prepareTemplateDatabase(): Promise<void> {
  await withAdminClient(async (admin) => {
    await admin.query(
      `DROP DATABASE IF EXISTS "${TEMPLATE_DB_NAME}" WITH (FORCE)`,
    );
    await admin.query(`CREATE DATABASE "${TEMPLATE_DB_NAME}"`);
  });

  const pool = new Pool({ connectionString: getDatabaseUri(TEMPLATE_DB_NAME) });

  try {
    await runMigrationsUp(pool);

    // The app creates the current/next monthly partitions through its
    // prune-and-create job at boot; run that same path here.
    await pruneAndCreatePartitions(
      pool,
      loadConfig().FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS,
    );

    // Integration tests insert backdated rows (failure history), which need
    // trailing partitions the prune job never creates.
    const startOfMonth = dayjs().utc().startOf('month');

    for (let monthsBack = 1; monthsBack <= 6; monthsBack++) {
      const month = startOfMonth.subtract(monthsBack, 'month');
      const tableName = `request_partitioned_y${month.year()}m${
        month.month() + 1
      }`;

      await pool.query(
        `CREATE TABLE IF NOT EXISTS ${tableName} PARTITION OF request_partitioned` +
          ` FOR VALUES FROM ('${month.toISOString()}')` +
          ` TO ('${month.add(1, 'month').toISOString()}')`,
      );
    }
  } finally {
    await pool.end();
  }
}

let pool: Pool | undefined;
let dbName: string | undefined;

/**
 * Clones the template database under a unique name for the current test file.
 * Call in the file's before() hook; node:test runs files in separate
 * processes, so the unique name keeps parallel files isolated.
 */
export async function setupPostgresTests(): Promise<Pool> {
  dbName = `feedrequests_test_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await withAdminClient(async (admin) => {
    await admin.query(
      `CREATE DATABASE "${dbName}" TEMPLATE "${TEMPLATE_DB_NAME}"`,
    );
  });

  // Keeps N parallel test files well under the Postgres default
  // max_connections (100); files run sequentially within themselves.
  pool = new Pool({ connectionString: getDatabaseUri(dbName), max: 4 });

  return pool;
}

export function getTestPool(): Pool {
  if (!pool) {
    throw new Error('Test pool has not been initialized');
  }

  return pool;
}

/** Resets the partitioned tables between tests (FK-safe, single statement). */
export async function truncatePartitionedTables(): Promise<void> {
  await getTestPool().query(`TRUNCATE request_partitioned, response_bodies`);
}

export async function teardownPostgresTests(): Promise<void> {
  if (!pool) {
    return;
  }

  const name = dbName;
  dbName = undefined;
  await pool.end();
  pool = undefined;

  await withAdminClient(async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
}

/**
 * Creates an empty (non-template) database and returns a pool for it.
 * Used by the migration suite, which must apply migrations to pristine
 * databases itself.
 */
export async function createEmptyDatabase(name: string): Promise<Pool> {
  await withAdminClient(async (admin) => {
    await admin.query(`CREATE DATABASE "${name}"`);
  });

  return new Pool({ connectionString: getDatabaseUri(name), max: 4 });
}

export async function dropDatabase(name: string): Promise<void> {
  await withAdminClient(async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
}
