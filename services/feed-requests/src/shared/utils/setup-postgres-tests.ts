import { MikroORM } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Client } from 'pg';
import config from '../../config';

let orm: MikroORM | undefined;
const dbName = `feedrequests-test-${process.pid}`;

/**
 * Provisions a dedicated database for a suite: the partitioned-requests store
 * uses raw SQL, which resolves through the connection's default search path
 * rather than the ORM schema, so the store's tables must exist in `public` of
 * a database the dev tables never share. The database name is unique per
 * process because the test runner may run suites in parallel processes.
 */
export async function setupPostgresTests(): Promise<MikroORM> {
  const testDbUrl = new URL(config().FEED_REQUESTS_POSTGRES_URI);
  testDbUrl.pathname = `/${dbName}`;

  const adminClient = new Client({
    connectionString: config().FEED_REQUESTS_POSTGRES_URI,
  });
  await adminClient.connect();

  try {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    // A leftover database from a previous run of this worker pid is fine; the
    // tables are recreated below. 42P04 = duplicate_database.
    if ((err as { code?: string }).code !== '42P04') {
      throw err;
    }
  } finally {
    await adminClient.end();
  }

  orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    metadataProvider: ReflectMetadataProvider,
    entities: ['dist/**/*.entity.js'],
    entitiesTs: ['src/**/*.entity.ts'],
    clientUrl: testDbUrl.toString(),
    forceUtcTimezone: true,
    timezone: 'UTC',
    allowGlobalContext: true,
  });

  await recreatePartitionedTables();

  return orm;
}

export async function recreatePartitionedTables(): Promise<void> {
  await dropPartitionedTables();

  const connection = orm!.em.getConnection();

  await connection.execute(
    `CREATE TYPE request_partitioned_status AS ENUM (
      'OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE',
      'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH', 'INVALID_SSL_CERTIFICATE'
    );`,
  );
  await connection.execute(
    `CREATE TYPE request_partitioned_source AS ENUM ('SHEDULE');`,
  );
  await connection.execute(
    `CREATE TABLE response_bodies (
      content TEXT NOT NULL,
      hash_key TEXT NOT NULL,
      content_hash TEXT DEFAULT NULL NULL,
      CONSTRAINT response_bodies_hash_key UNIQUE (hash_key)
    );`,
  );
  await connection.execute(
    `CREATE TABLE request_partitioned (
      id TEXT NOT NULL,
      status request_partitioned_status NOT NULL,
      source request_partitioned_source DEFAULT NULL NULL,
      fetch_options JSON DEFAULT NULL NULL,
      url TEXT NOT NULL,
      url_hash TEXT DEFAULT NULL NULL,
      host_hash TEXT DEFAULT NULL NULL,
      lookup_key TEXT DEFAULT NULL NULL,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
      next_retry_date TIMESTAMPTZ DEFAULT NULL NULL,
      error_message TEXT DEFAULT NULL NULL,
      response_status_code INT DEFAULT NULL NULL,
      response_text_hash TEXT DEFAULT NULL NULL,
      response_body_hash_key TEXT DEFAULT NULL NULL,
      response_s3object_key TEXT DEFAULT NULL NULL,
      response_redis_cache_key TEXT DEFAULT NULL NULL,
      response_headers JSON DEFAULT NULL NULL,
      request_initiated_at TIMESTAMPTZ DEFAULT NULL NULL,
      PRIMARY KEY (id, created_at)
    );`,
  );
  await connection.execute(
    `CREATE INDEX request_partitioned_lookupkey_created_at_status_index
      ON request_partitioned (lookup_key, created_at, status);`,
  );
}

export async function teardownPostgresTests(): Promise<void> {
  if (!orm) {
    return;
  }

  await dropPartitionedTables();
  await orm.close();

  const adminClient = new Client({
    connectionString: config().FEED_REQUESTS_POSTGRES_URI,
  });
  await adminClient.connect();

  try {
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  } finally {
    await adminClient.end();
  }
}

async function dropPartitionedTables(): Promise<void> {
  const connection = orm!.em.getConnection();

  await connection.execute(`DROP TABLE IF EXISTS request_partitioned CASCADE;`);
  await connection.execute(`DROP TABLE IF EXISTS response_bodies CASCADE;`);
  await connection.execute(
    `DROP TYPE IF EXISTS request_partitioned_status CASCADE;`,
  );
  await connection.execute(
    `DROP TYPE IF EXISTS request_partitioned_source CASCADE;`,
  );
}
