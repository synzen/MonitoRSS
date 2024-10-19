import { Migration } from '@mikro-orm/migrations';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const currentMonth = dayjs().utc().startOf('month')
const previousMonth  = dayjs().utc().subtract(1, 'month').startOf('month')
const currentYear = dayjs().utc().year()

const ranges = [
  {
    start: currentMonth.toISOString(),
    end: dayjs().utc().add(1, 'month').startOf('month').toISOString(),
    tableName: `delivery_records_partitioned_y${currentYear}m${currentMonth.month() + 1}`,
  },
  {
    start: previousMonth.toISOString(),
    end: currentMonth.toISOString(),
    tableName: `delivery_records_partitioned_y${currentYear}m${currentMonth.month()}`,
  },
];

export class Migration20241019132933 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TYPE delivery_record_partitioned_status AS ENUM ('pending-delivery', 'sent', 'failed', 'rejected', 'filtered-out', 'rate-limited', 'medium-rate-limited-by-user');`);
    this.addSql(`CREATE TYPE delivery_record_partitioned_content_type AS ENUM ('discord-article-message', 'discord-thread-creation');`);
    this.addSql(`
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
      article_id_hash TEXT
      ) PARTITION BY RANGE (created_at);
    `);

    for (const { start, end, tableName } of ranges) {
      this.addSql(`
        CREATE TABLE ${tableName} PARTITION OF delivery_record_partitioned
        FOR VALUES FROM ('${start}') TO ('${end}');
      `);
    }

    this.addSql(`CREATE INDEX delivery_record_migration_test_idx ON delivery_record (created_at);`);
    this.addSql(`
      INSERT INTO delivery_record_partitioned
            (id, feed_id, medium_id, created_at, status, content_type, parent_id, internal_message, error_code, external_detail, article_id, article_id_hash)
      SELECT id, feed_id, medium_id, created_at, status::delivery_record_partitioned_status, content_type::delivery_record_partitioned_content_type, parent_id, internal_message, error_code, external_detail, article_id, article_id_hash
      FROM delivery_record WHERE created_at >= '${ranges[ranges.length - 1].start}';
    `);
    this.addSql(`DROP INDEX delivery_record_migration_test_idx`);

    // primary key on id
    this.addSql(`CREATE INDEX delivery_record_partitioned_id ON delivery_record_partitioned (id);`);
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_timeframe_count ON delivery_record_partitioned (feed_id, status, created_at);`);
    this.addSql(`CREATE INDEX delivery_record_partitioned_medium_timeframe_count ON delivery_record_partitioned (medium_id, status, created_at);`);
    this.addSql(`CREATE INDEX delivery_record_partitioned_article_id_hash ON delivery_record_partitioned (article_id_hash);`);
    // Used for querying delivery records for user views
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_parent_created_at ON delivery_record_partitioned (feed_id, parent_id, created_at);`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE delivery_record_partitioned;`);
    this.addSql(`DROP TYPE delivery_record_partitioned_status;`);
    this.addSql(`DROP TYPE delivery_record_partitioned_content_type;`);
  }

}
