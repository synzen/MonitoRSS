import type { SQL } from "bun";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { logger } from "../utils";

dayjs.extend(utc);

// ============================================================================
// Migration Types
// ============================================================================

interface Migration {
  version: string;
  name: string;
  up: (sql: SQL) => Promise<void>;
}

// ============================================================================
// Migration Tracking
// ============================================================================

async function ensureMigrationsTableExists(sql: SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )
  `;
}

async function getExecutedMigrations(sql: SQL): Promise<Set<string>> {
  const rows = await sql`SELECT version FROM schema_migrations`;
  return new Set(rows.map((r: { version: string }) => r.version));
}

async function recordMigration(sql: SQL, migration: Migration): Promise<void> {
  await sql`
    INSERT INTO schema_migrations (version, name)
    VALUES (${migration.version}, ${migration.name})
  `;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function tableExists(sql: SQL, tableName: string): Promise<boolean> {
  const [result] = await sql`
    SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = ${tableName}
    ) as exists
  `;
  return result?.exists === true;
}

async function typeExists(sql: SQL, typeName: string): Promise<boolean> {
  const [result] = await sql`
    SELECT EXISTS (
      SELECT FROM pg_type
      WHERE typname = ${typeName}
    ) as exists
  `;
  return result?.exists === true;
}

async function indexExists(sql: SQL, indexName: string): Promise<boolean> {
  const [result] = await sql`
    SELECT EXISTS (
      SELECT FROM pg_indexes
      WHERE indexname = ${indexName}
    ) as exists
  `;
  return result?.exists === true;
}

// ============================================================================
// Migrations
// ============================================================================

const migrations: Migration[] = [
  {
    version: "20251206_001",
    name: "initial_schema",
    up: async (sql) => {
      // Create ENUMs
      if (!(await typeExists(sql, "delivery_record_partitioned_status"))) {
        await sql.unsafe(`
          CREATE TYPE delivery_record_partitioned_status AS ENUM (
            'pending-delivery', 'sent', 'failed', 'rejected',
            'filtered-out', 'rate-limited', 'medium-rate-limited-by-user'
          )
        `);
      }

      if (!(await typeExists(sql, "delivery_record_partitioned_content_type"))) {
        await sql.unsafe(`
          CREATE TYPE delivery_record_partitioned_content_type AS ENUM (
            'discord-article-message', 'discord-thread-creation'
          )
        `);
      }

      // Create feed_article_field_partitioned table
      if (!(await tableExists(sql, "feed_article_field_partitioned"))) {
        await sql.unsafe(`
          CREATE TABLE feed_article_field_partitioned (
            id SERIAL NOT NULL,
            feed_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            field_hashed_value TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
          ) PARTITION BY RANGE (created_at)
        `);
      }

      const feedArticleFieldIndex =
        "feed_article_field_partitioned_id_name_value_created";
      if (!(await indexExists(sql, feedArticleFieldIndex))) {
        await sql.unsafe(`
          CREATE INDEX ${feedArticleFieldIndex}
          ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value, created_at)
        `);
      }

      // Create delivery_record_partitioned table
      if (!(await tableExists(sql, "delivery_record_partitioned"))) {
        await sql.unsafe(`
          CREATE TABLE delivery_record_partitioned (
            id TEXT NOT NULL,
            feed_id TEXT NOT NULL,
            medium_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            status delivery_record_partitioned_status NOT NULL,
            content_type delivery_record_partitioned_content_type,
            parent_id TEXT,
            internal_message TEXT,
            error_code TEXT,
            external_detail TEXT,
            article_id TEXT,
            article_id_hash TEXT,
            article_data JSONB
          ) PARTITION BY RANGE (created_at)
        `);
      }

      // Create delivery_record indexes
      const deliveryRecordIndexes = [
        {
          name: "delivery_record_partitioned_id",
          sql: "CREATE INDEX delivery_record_partitioned_id ON delivery_record_partitioned (id)",
        },
        {
          name: "delivery_record_partitioned_feed_timeframe_count",
          sql: "CREATE INDEX delivery_record_partitioned_feed_timeframe_count ON delivery_record_partitioned (created_at, status, feed_id)",
        },
        {
          name: "delivery_record_partitioned_medium_timeframe_count",
          sql: "CREATE INDEX delivery_record_partitioned_medium_timeframe_count ON delivery_record_partitioned (medium_id, status, created_at)",
        },
        {
          name: "delivery_record_partitioned_article_id_hash",
          sql: "CREATE INDEX delivery_record_partitioned_article_id_hash ON delivery_record_partitioned (article_id_hash)",
        },
        {
          name: "delivery_record_partitioned_feed_parent_created_at",
          sql: "CREATE INDEX delivery_record_partitioned_feed_parent_created_at ON delivery_record_partitioned (feed_id, parent_id, created_at)",
        },
      ];

      for (const index of deliveryRecordIndexes) {
        if (!(await indexExists(sql, index.name))) {
          await sql.unsafe(index.sql);
        }
      }

      // Create feed_article_custom_comparison table
      if (!(await tableExists(sql, "feed_article_custom_comparison"))) {
        await sql.unsafe(`
          CREATE TABLE feed_article_custom_comparison (
            id SERIAL PRIMARY KEY,
            feed_id VARCHAR(255) NOT NULL,
            field_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          )
        `);
        await sql.unsafe(`
          ALTER TABLE feed_article_custom_comparison
          ADD CONSTRAINT unique_feed_field UNIQUE (feed_id, field_name)
        `);
      }

      // Create feed_retry_record table
      if (!(await tableExists(sql, "feed_retry_record"))) {
        await sql.unsafe(`
          CREATE TABLE feed_retry_record (
            id SERIAL PRIMARY KEY,
            feed_id VARCHAR(255) NOT NULL UNIQUE,
            attempts_so_far INT NOT NULL
          )
        `);
        await sql.unsafe(`
          CREATE INDEX feed_retry_record_feed_id ON feed_retry_record (feed_id)
        `);
      }

      // Create response_hash table
      if (!(await tableExists(sql, "response_hash"))) {
        await sql.unsafe(`
          CREATE TABLE response_hash (
            feed_id TEXT PRIMARY KEY,
            hash TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
          )
        `);
      }
    },
  },
  // Future migrations go here:
  // {
  //   version: "20251207_001",
  //   name: "add_new_column",
  //   up: async (sql) => {
  //     await sql`ALTER TABLE some_table ADD COLUMN new_col TEXT`;
  //   },
  // },
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Run all pending migrations.
 * Tracks executed migrations in schema_migrations table.
 */
export async function runMigrations(sql: SQL): Promise<void> {
  await ensureMigrationsTableExists(sql);

  const executed = await getExecutedMigrations(sql);
  let ranCount = 0;

  for (const migration of migrations) {
    if (executed.has(migration.version)) {
      continue;
    }

    logger.info(`Running migration ${migration.version}: ${migration.name}`);
    await migration.up(sql);
    await recordMigration(sql, migration);
    ranCount++;
  }

  if (ranCount === 0) {
    logger.info("Migrations: schema up to date");
  } else {
    logger.info(`Migrations: ran ${ranCount} migration(s)`);
  }
}

/**
 * Ensure partitions exist for current and next month.
 * This runs on every startup (not versioned) since partitions depend on current date.
 */
export async function ensurePartitionsExist(sql: SQL): Promise<void> {
  const startOfMonth = dayjs().utc().startOf("month");
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, "month");
  const nextNextMonthDate = startOfMonth.add(2, "month");

  const partitions = [
    {
      tableName: `feed_article_field_partitioned_y${thisMonthDate.year()}m${thisMonthDate.month() + 1}`,
      parentTable: "feed_article_field_partitioned",
      from: thisMonthDate.toISOString(),
      to: nextMonthDate.toISOString(),
    },
    {
      tableName: `feed_article_field_partitioned_y${nextMonthDate.year()}m${nextMonthDate.month() + 1}`,
      parentTable: "feed_article_field_partitioned",
      from: nextMonthDate.toISOString(),
      to: nextNextMonthDate.toISOString(),
    },
    {
      tableName: `delivery_record_partitioned_y${thisMonthDate.year()}m${thisMonthDate.month() + 1}`,
      parentTable: "delivery_record_partitioned",
      from: thisMonthDate.toISOString(),
      to: nextMonthDate.toISOString(),
    },
    {
      tableName: `delivery_record_partitioned_y${nextMonthDate.year()}m${nextMonthDate.month() + 1}`,
      parentTable: "delivery_record_partitioned",
      from: nextMonthDate.toISOString(),
      to: nextNextMonthDate.toISOString(),
    },
  ];

  let created = 0;
  for (const partition of partitions) {
    if (await tableExists(sql, partition.tableName)) {
      continue;
    }

    await sql.unsafe(`
      CREATE TABLE ${partition.tableName}
      PARTITION OF ${partition.parentTable}
      FOR VALUES FROM ('${partition.from}') TO ('${partition.to}')
    `);
    created++;
  }

  if (created > 0) {
    logger.debug(`Partition tables created`, {
      count: created,
    });
  }
}

/**
 * Truncate all tables (for testing).
 * Does not drop tables or types.
 */
export async function truncateAllTables(sql: SQL): Promise<void> {
  await sql`TRUNCATE TABLE feed_article_field_partitioned CASCADE`;
  await sql`TRUNCATE TABLE delivery_record_partitioned CASCADE`;
  await sql`TRUNCATE TABLE feed_article_custom_comparison CASCADE`;
  await sql`TRUNCATE TABLE feed_retry_record CASCADE`;
  await sql`TRUNCATE TABLE response_hash CASCADE`;
}
