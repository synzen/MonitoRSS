import { after, describe, it } from 'node:test';
import assert from 'node:assert';
import { Client, Pool } from 'pg';
import { runMigrationsDown, runMigrationsUp, MIGRATIONS } from './migrations';
import { loadConfig } from '../../config';
import { silenceLogger } from '../../test/helpers/silence-logger';

silenceLogger();

// Migration scenarios need a pristine database each: the migration set creates
// tables that the shared partitioned-table test setup also creates directly.
const dbName = `feedrequests-test-migrations-${process.pid}`;

async function createFreshDatabase(): Promise<Pool> {
  const adminClient = new Client({
    connectionString: loadConfig().FEED_REQUESTS_POSTGRES_URI,
  });
  await adminClient.connect();

  try {
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminClient.end();
  }

  const testDbUrl = new URL(loadConfig().FEED_REQUESTS_POSTGRES_URI);
  testDbUrl.pathname = `/${dbName}`;

  return new Pool({ connectionString: testDbUrl.toString() });
}

async function dropDatabase(): Promise<void> {
  const adminClient = new Client({
    connectionString: loadConfig().FEED_REQUESTS_POSTGRES_URI,
  });
  await adminClient.connect();

  try {
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  } finally {
    await adminClient.end();
  }
}

describe('migrations (Integration)', () => {
  after(async () => {
    await dropDatabase();
  });

  describe('runMigrationsUp', () => {
    it('applies the full migration set to a fresh database', async () => {
      const pool = await createFreshDatabase();

      try {
        const executed = await runMigrationsUp(pool);

        assert.strictEqual(executed.length, MIGRATIONS.length);

        const { rows } = await pool.query(
          `SELECT version FROM schema_migrations ORDER BY version ASC`,
        );

        assert.strictEqual(rows.length, MIGRATIONS.length);

        // Spot-check that the schema is real: the partitioned tables exist
        const tables = await pool.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_name IN ('request_partitioned', 'response_bodies')`,
        );

        assert.strictEqual(tables.rowCount, 2);
      } finally {
        await pool.end();
      }
    });

    it('is idempotent — a second run applies nothing', async () => {
      const pool = await createFreshDatabase();

      try {
        await runMigrationsUp(pool);
        const second = await runMigrationsUp(pool);

        assert.strictEqual(second.length, 0);
      } finally {
        await pool.end();
      }
    });
  });

  describe('legacy history cutover', () => {
    it('seeds the tracking table from the legacy table without re-executing', async () => {
      const pool = await createFreshDatabase();

      try {
        // Simulate a database migrated by the legacy ORM runner: its history
        // table claims everything is applied.
        await pool.query(`
          CREATE TABLE mikro_orm_migrations (
            id serial primary key,
            name text not null,
            executed_at timestamptz not null default now()
          )
        `);

        for (const migration of MIGRATIONS) {
          await pool.query(
            `INSERT INTO mikro_orm_migrations (name) VALUES ($1)`,
            [migration.name],
          );
        }

        const executed = await runMigrationsUp(pool);

        assert.strictEqual(executed.length, 0);

        const { rows } = await pool.query(
          `SELECT version FROM schema_migrations`,
        );

        assert.strictEqual(rows.length, MIGRATIONS.length);
      } finally {
        await pool.end();
      }
    });

    it('applies only pending migrations on top of a partial legacy history', async () => {
      const pool = await createFreshDatabase();

      try {
        await pool.query(`
          CREATE TABLE mikro_orm_migrations (
            id serial primary key,
            name text not null,
            executed_at timestamptz not null default now()
          )
        `);

        // Simulate the legacy runner having applied the first half: the schema
        // changes actually ran AND the history rows were recorded.
        const half = MIGRATIONS.slice(0, Math.floor(MIGRATIONS.length / 2));
        const client = await pool.connect();

        try {
          for (const migration of half) {
            await migration.up(client);
            await client.query(
              `INSERT INTO mikro_orm_migrations (name) VALUES ($1)`,
              [migration.name],
            );
          }
        } finally {
          client.release();
        }

        const executed = await runMigrationsUp(pool);

        assert.strictEqual(executed.length, MIGRATIONS.length - half.length);

        const { rows } = await pool.query(
          `SELECT version FROM schema_migrations`,
        );

        assert.strictEqual(rows.length, MIGRATIONS.length);
      } finally {
        await pool.end();
      }
    });

    it('does not touch the tracking table when no legacy history exists', async () => {
      const pool = await createFreshDatabase();

      try {
        await runMigrationsUp(pool);

        // No legacy table was ever created by the runner itself
        const legacy = await pool.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = 'mikro_orm_migrations'`,
        );

        assert.strictEqual(legacy.rowCount, 0);
      } finally {
        await pool.end();
      }
    });
  });

  describe('runMigrationsDown', () => {
    it('reverts the last applied migration and removes its history row', async () => {
      const pool = await createFreshDatabase();

      try {
        await runMigrationsUp(pool);

        const before = await pool.query(
          `SELECT count(*)::int AS count FROM schema_migrations`,
        );

        const reverted = await runMigrationsDown(pool);

        const last = MIGRATIONS[MIGRATIONS.length - 1];

        assert.strictEqual(reverted, last.version);

        const after = await pool.query(
          `SELECT count(*)::int AS count FROM schema_migrations`,
        );

        assert.strictEqual(after.rows[0].count, before.rows[0].count - 1);
      } finally {
        await pool.end();
      }
    });

    it('throws when there is nothing to revert', async () => {
      const pool = await createFreshDatabase();

      try {
        await assert.rejects(() => runMigrationsDown(pool));
      } finally {
        await pool.end();
      }
    });
  });
});
