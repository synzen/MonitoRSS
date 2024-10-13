import { Migration } from '@mikro-orm/migrations';

export class Migration20240924220729 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE feed_article_field_partitioned (
      id SERIAL NOT NULL,
      feed_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_hashed_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      ) PARTITION BY RANGE (created_at);`);

    this.addSql(`CREATE TABLE feed_article_field_partitioned_oldvalues PARTITION OF feed_article_field_partitioned FOR VALUES FROM ('2022-09-24 22:07:29') TO ('2024-10-01T00:00:00.000Z');`);
    this.addSql(`CREATE TABLE feed_article_field_partitioned_y2024m10 PARTITION OF feed_article_field_partitioned FOR VALUES FROM ('2024-10-01T00:00:00.000Z') TO ('2024-11-01T00:00:00.000Z');`);

    this.addSql(`CREATE INDEX feed_article_field_partitioned_createdat_index ON feed_article_field_partitioned (created_at);`);
    this.addSql('CREATE INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value);');
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE feed_article_field_partitioned;`);
  }
}
