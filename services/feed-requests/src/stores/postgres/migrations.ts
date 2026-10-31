import type { Pool, PoolClient } from 'pg';
import logger from '../../utils/logger';
import {
  LEGACY_MIGRATIONS,
  type LegacyMigration,
} from './legacy-migrations.generated';

// The tracking table used by this runner. Databases migrated by the previous
// MikroORM-based runner are cut over from its history table instead of
// re-running migrations (see cutoverLegacyHistory).
const MIGRATIONS_TABLE = 'schema_migrations';
const LEGACY_MIGRATIONS_TABLE = 'mikro_orm_migrations';

export interface Migration {
  version: string;
  name: string;
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

// To add a migration, append an entry here with a new 14-digit UTC timestamp
// version (YYYYMMDDHHmmss) and hand-written up/down SQL statements.
export const MIGRATIONS: Migration[] = [
  ...LEGACY_MIGRATIONS.map(toMigration),
  {
    version: '20261031140122',
    name: 'Migration20261031140122',
    async up(client) {
      // Adopting the existing unique index is metadata-only: no table rewrite,
      // just a momentary ACCESS EXCLUSIVE lock. The lock timeout keeps the
      // ALTER from queueing behind a long transaction and stalling traffic —
      // if it can't get the lock in 5s it fails fast and the run can be
      // retried.
      await client.query(`SET LOCAL lock_timeout = '5s'`);
      await client.query(`
        ALTER TABLE response_bodies
        ADD CONSTRAINT response_bodies_pkey
        PRIMARY KEY USING INDEX response_bodies_hash_key;
      `);
    },
    async down(client) {
      await client.query(`SET LOCAL lock_timeout = '5s'`);
      await client.query(`
        ALTER TABLE response_bodies
        DROP CONSTRAINT response_bodies_pkey;
      `);
      await client.query(`
        CREATE UNIQUE INDEX response_bodies_hash_key ON response_bodies (hash_key);
      `);
    },
  },
];

function toMigration(legacy: LegacyMigration): Migration {
  return {
    version: legacy.version,
    name: legacy.name,
    async up(client) {
      for (const statement of legacy.upStatements) {
        await client.query(statement);
      }
    },
    async down(client) {
      for (const statement of legacy.downStatements) {
        await client.query(statement);
      }
    },
  };
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )
  `);
}

async function getAppliedVersions(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT version FROM ${MIGRATIONS_TABLE}`);

  return new Set(rows.map((r: { version: string }) => r.version));
}

/**
 * Seeds the tracking table from the legacy MikroORM history table on first
 * run against an existing database, so already-applied migrations are
 * recognized instead of re-executed.
 */
async function cutoverLegacyHistory(pool: Pool): Promise<number> {
  const legacyTableExists = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_name = '${LEGACY_MIGRATIONS_TABLE}'`,
  );

  if (legacyTableExists.rowCount === 0) {
    return 0;
  }

  const { rows: applied } = await pool.query(
    `SELECT version FROM ${MIGRATIONS_TABLE}`,
  );

  if (applied.length > 0) {
    return 0;
  }

  const { rows: legacyRows } = await pool.query(
    `SELECT name FROM ${LEGACY_MIGRATIONS_TABLE} ORDER BY name ASC`,
  );

  if (legacyRows.length === 0) {
    return 0;
  }

  const client = await pool.connect();
  let cutOver = 0;

  try {
    await client.query('BEGIN');

    for (const row of legacyRows as Array<{ name: string }>) {
      const versionMatch = row.name.match(/(\d{14})/);

      if (!versionMatch) {
        logger.error(
          `Skipping legacy migration history row with unrecognized name ${row.name}`,
        );
        continue;
      }

      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        [versionMatch[1], row.name],
      );
      cutOver++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info(
    `Cut over ${cutOver} legacy migration history rows from ${LEGACY_MIGRATIONS_TABLE}`,
  );

  return cutOver;
}

export async function runMigrationsUp(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);
  await cutoverLegacyHistory(pool);

  const applied = await getAppliedVersions(pool);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version.localeCompare(b.version),
  );
  const executed: string[] = [];

  for (const migration of pending) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await migration.up(client);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name],
      );
      await client.query('COMMIT');

      executed.push(migration.version);
      logger.info(`Applied migration ${migration.name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Failed to apply migration ${migration.name}`, {
        error: (err as Error).stack,
      });
      throw err;
    } finally {
      client.release();
    }
  }

  return executed;
}

export async function runMigrationsDown(pool: Pool): Promise<string> {
  await ensureMigrationsTable(pool);
  await cutoverLegacyHistory(pool);

  const { rows } = await pool.query(
    `SELECT version, name FROM ${MIGRATIONS_TABLE}
     ORDER BY executed_at DESC, version DESC
     LIMIT 1`,
  );

  const last = rows[0] as { version: string; name: string } | undefined;

  if (!last) {
    throw new Error('No applied migrations to revert');
  }

  const migration = MIGRATIONS.find((m) => m.version === last.version);

  if (!migration) {
    throw new Error(
      `Applied migration ${last.name} has no revert implementation in this runner`,
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await migration.down(client);
    await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1`, [
      last.version,
    ]);
    await client.query('COMMIT');

    logger.info(`Reverted migration ${last.name}`);

    return last.version;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`Failed to revert migration ${last.name}`, {
      error: (err as Error).stack,
    });
    throw err;
  } finally {
    client.release();
  }
}
