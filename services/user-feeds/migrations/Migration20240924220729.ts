import { Migration } from '@mikro-orm/migrations';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export class Migration20240924220729 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE feed_article_field_partitioned (
      id SERIAL NOT NULL,
      feed_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_hashed_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      ) PARTITION BY RANGE (created_at);`);

    const endDate = dayjs().utc().subtract(5, 'month').startOf('month')

    this.addSql(`CREATE TABLE feed_article_field_partitioned_oldvalues PARTITION OF feed_article_field_partitioned FOR VALUES FROM ('2000-09-24 22:07:29') TO ('${endDate.toISOString()}');`);

    this.addSql(`CREATE INDEX feed_article_field_partitioned_createdat_index ON feed_article_field_partitioned (created_at);`);
    this.addSql('CREATE INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value);');
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE feed_article_field_partitioned;`);
  }
}
