import type { Pool } from "pg";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { logger } from "../../shared/utils";

dayjs.extend(utc);

// ============================================================================
// Migration Types
// ============================================================================

interface Migration {
  version: string;
  name: string;
  up: (pool: Pool) => Promise<void>;
}

// ============================================================================
// Migration Tracking
// ============================================================================

async function ensureMigrationsTableExists(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )
  `);
}

async function getExecutedMigrations(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT version FROM schema_migrations`);
  return new Set(rows.map((r: { version: string }) => r.version));
}

async function recordMigration(pool: Pool, migration: Migration): Promise<void> {
  await pool.query(
    `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
    [migration.version, migration.name]
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE tablename = $1
    ) as exists`,
    [tableName]
  );
  return rows[0]?.exists === true;
}

async function indexExists(pool: Pool, indexName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT EXISTS (
      SELECT FROM pg_indexes
      WHERE indexname = $1
    ) as exists`,
    [indexName]
  );
  return rows[0]?.exists === true;
}

// ============================================================================
// Migrations
// ============================================================================

const migrations: Migration[] = [
  {
    version: "20251206_001",
    name: "initial_schema",
    up: async (pool) => {
      // Create ENUMs
      await pool.query(`
        CREATE TYPE delivery_record_partitioned_status AS ENUM (
          'pending-delivery', 'sent', 'failed', 'rejected',
          'filtered-out', 'rate-limited', 'medium-rate-limited-by-user'
        )
      `);

      await pool.query(`
        CREATE TYPE delivery_record_partitioned_content_type AS ENUM (
          'discord-article-message', 'discord-thread-creation'
        )
      `);

      // Create feed_article_field_partitioned table
      if (!(await tableExists(pool, "feed_article_field_partitioned"))) {
        await pool.query(`
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
      if (!(await indexExists(pool, feedArticleFieldIndex))) {
        await pool.query(`
          CREATE INDEX ${feedArticleFieldIndex}
          ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value, created_at)
        `);
      }

      // Create delivery_record_partitioned table
      if (!(await tableExists(pool, "delivery_record_partitioned"))) {
        await pool.query(`
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
        if (!(await indexExists(pool, index.name))) {
          await pool.query(index.sql);
        }
      }

      // Create feed_article_custom_comparison table
      if (!(await tableExists(pool, "feed_article_custom_comparison"))) {
        await pool.query(`
          CREATE TABLE feed_article_custom_comparison (
            id SERIAL PRIMARY KEY,
            feed_id VARCHAR(255) NOT NULL,
            field_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          )
        `);
        await pool.query(`
          ALTER TABLE feed_article_custom_comparison
          ADD CONSTRAINT unique_feed_field UNIQUE (feed_id, field_name)
        `);
      }

      // Create feed_retry_record table
      if (!(await tableExists(pool, "feed_retry_record"))) {
        await pool.query(`
          CREATE TABLE feed_retry_record (
            id SERIAL PRIMARY KEY,
            feed_id VARCHAR(255) NOT NULL UNIQUE,
            attempts_so_far INT NOT NULL
          )
        `);
        await pool.query(`
          CREATE INDEX feed_retry_record_feed_id ON feed_retry_record (feed_id)
        `);
      }

      // Create response_hash table
      if (!(await tableExists(pool, "response_hash"))) {
        await pool.query(`
          CREATE TABLE response_hash (
            id SERIAL PRIMARY KEY,
            feed_id TEXT NOT NULL UNIQUE,
            hash TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
          )
        `);
      }
    },
  },
  {
    version: "20251210_001",
    name: "add_feed_retry_record_created_at",
    up: async (pool) => {
      // Check if column already exists
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'feed_retry_record' AND column_name = 'created_at'`
      );

      if (rows.length === 0) {
        await pool.query(`
          ALTER TABLE feed_retry_record
          ADD COLUMN created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        `);
      }
    },
  },
  // Future migrations go here:
  // {
  //   version: "20251207_001",
  //   name: "add_new_column",
  //   up: async (pool) => {
  //     await pool.query(`ALTER TABLE some_table ADD COLUMN new_col TEXT`);
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
export async function runMigrations(pool: Pool): Promise<void> {
  await ensureMigrationsTableExists(pool);

  const executed = await getExecutedMigrations(pool);
  let ranCount = 0;

  for (const migration of migrations) {
    if (executed.has(migration.version)) {
      continue;
    }

    logger.info(`Running migration ${migration.version}: ${migration.name}`);
    await migration.up(pool);
    await recordMigration(pool, migration);
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
export async function ensurePartitionsExist(pool: Pool): Promise<void> {
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
    if (await tableExists(pool, partition.tableName)) {
      continue;
    }

    // Note: PostgreSQL does not support parameterized queries in DDL statements.
    // These values are safe as they come from dayjs() date calculations, not user input.
    await pool.query(`
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

// ============================================================================
// Partition Management
// ============================================================================

interface PartitionInfo {
  parentSchema: string;
  parent: string;
  childSchema: string;
  child: string;
}

/**
 * Extract year and month from partition name like "feed_article_field_partitioned_y2025m12"
 */
function parsePartitionDate(partitionName: string): { year: number; month: number } | null {
  const match = partitionName.match(/_y(\d+)m(\d+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

/**
 * Get all current partitions for a given parent table, sorted chronologically (oldest first).
 */
async function getCurrentPartitions(
  pool: Pool,
  tableName: string
): Promise<PartitionInfo[]> {
  const { rows } = await pool.query(
    `SELECT
      nmsp_parent.nspname AS parent_schema,
      parent.relname      AS parent,
      nmsp_child.nspname  AS child_schema,
      child.relname       AS child
    FROM pg_inherits
      JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
      JOIN pg_namespace nmsp_parent   ON nmsp_parent.oid  = parent.relnamespace
      JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace
    WHERE parent.relname = $1`,
    [tableName]
  );

  const partitions = rows.map(
    (row: {
      parent_schema: string;
      parent: string;
      child_schema: string;
      child: string;
    }) => ({
      parentSchema: row.parent_schema,
      parent: row.parent,
      childSchema: row.child_schema,
      child: row.child,
    })
  );

  // Sort chronologically by year and month (oldest first)
  partitions.sort((a: PartitionInfo, b: PartitionInfo) => {
    const dateA = parsePartitionDate(a.child);
    const dateB = parsePartitionDate(b.child);
    if (!dateA || !dateB) return 0;
    if (dateA.year !== dateB.year) return dateA.year - dateB.year;
    return dateA.month - dateB.month;
  });

  return partitions;
}

/**
 * Prune old partitions based on persistence configuration.
 * Currently just logs which partitions would be dropped (matching user-feeds behavior).
 */
export async function pruneOldPartitions(
  pool: Pool,
  options: {
    articlePersistenceMonths: number;
    deliveryRecordPersistenceMonths: number;
  }
): Promise<void> {
  const startOfMonth = dayjs().utc().startOf("month");
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, "month");

  // Names of partitions that should never be dropped (current/next month)
  const protectedPartitions = [
    `feed_article_field_partitioned_y${thisMonthDate.year()}m${thisMonthDate.month() + 1}`,
    `feed_article_field_partitioned_y${nextMonthDate.year()}m${nextMonthDate.month() + 1}`,
    `delivery_record_partitioned_y${thisMonthDate.year()}m${thisMonthDate.month() + 1}`,
    `delivery_record_partitioned_y${nextMonthDate.year()}m${nextMonthDate.month() + 1}`,
  ];

  // Prune feed_article_field_partitioned
  try {
    const articlePartitions = await getCurrentPartitions(
      pool,
      "feed_article_field_partitioned"
    );

    const numberOfArticlePartitionsToDrop =
      articlePartitions.length - options.articlePersistenceMonths;

    if (numberOfArticlePartitionsToDrop > 0) {
      const articleTablesToDrop = articlePartitions
        .slice(0, numberOfArticlePartitionsToDrop)
        .filter((partition) => !protectedPartitions.includes(partition.child));

      if (articleTablesToDrop.length) {
        logger.info(
          `Will eventually drop partitions for feed_article_field_partitioned`,
          {
            partitions: articleTablesToDrop.map((partition) => partition.child),
          }
        );

        // Uncomment below to actually drop partitions:
        // await Promise.all(
        //   articleTablesToDrop.map(async (partition) => {
        //     await pool.query(
        //       `DROP TABLE IF EXISTS ${partition.childSchema}.${partition.child};`
        //     );
        //   })
        // );
      }
    }
  } catch (err) {
    logger.error(
      "Failed to prune old partitions for feed_article_field_partitioned",
      {
        error: (err as Error).stack,
      }
    );
  }

  // Prune delivery_record_partitioned
  try {
    const deliveryPartitions = await getCurrentPartitions(
      pool,
      "delivery_record_partitioned"
    );

    if (deliveryPartitions.length > 1) {
      const numberOfDeliveryPartitionsToDrop =
        deliveryPartitions.length - options.deliveryRecordPersistenceMonths;

      if (numberOfDeliveryPartitionsToDrop > 0) {
        const deliveryTablesToDrop = deliveryPartitions
          .slice(0, numberOfDeliveryPartitionsToDrop)
          .filter((partition) => !protectedPartitions.includes(partition.child));

        if (deliveryTablesToDrop.length) {
          logger.info(
            `Will eventually drop partitions for delivery_record_partitioned`,
            {
              partitions: deliveryTablesToDrop.map(
                (partition) => partition.child
              ),
            }
          );

          // Uncomment below to actually drop partitions:
          // await Promise.all(
          //   deliveryTablesToDrop.map(async (partition) => {
          //     await pool.query(
          //       `DROP TABLE IF EXISTS ${partition.childSchema}.${partition.child};`
          //     );
          //   })
          // );
        }
      }
    }
  } catch (err) {
    logger.error(
      "Failed to prune old partitions for delivery_record_partitioned",
      {
        error: (err as Error).stack,
      }
    );
  }
}

/**
 * Truncate all tables (for testing).
 * Does not drop tables or types.
 */
export async function truncateAllTables(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE TABLE feed_article_field_partitioned CASCADE`);
  await pool.query(`TRUNCATE TABLE delivery_record_partitioned CASCADE`);
  await pool.query(`TRUNCATE TABLE feed_article_custom_comparison CASCADE`);
  await pool.query(`TRUNCATE TABLE feed_retry_record CASCADE`);
  await pool.query(`TRUNCATE TABLE response_hash CASCADE`);
}
