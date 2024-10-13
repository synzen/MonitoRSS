import { Migration } from '@mikro-orm/migrations';

const ranges = [
  {
    from: '2024-09-01T00:00:00.000Z',
    to: '2024-10-01T00:00:00.000Z',
  },
  {
    from: '2024-08-01T00:00:00.000Z',
    to: '2024-09-01T00:00:00.000Z',
  },
  {
    from: '2024-07-01T00:00:00.000Z',
    to: '2024-08-01T00:00:00.000Z',
  },
  {
    from: '2024-06-01T00:00:00.000Z',
    to: '2024-07-01T00:00:00.000Z',
  },
  {
    from: '2024-05-01T00:00:00.000Z',
    to: '2024-06-01T00:00:00.000Z',
  },
  {
    from: '2024-04-01T00:00:00.000Z',
    to: '2024-05-01T00:00:00.000Z',
  },
]

export class Migration20241013162508 extends Migration {

  async up(): Promise<void> {
    // detach feed_article_field_partitioned_oldvalues
    this.addSql('ALTER TABLE feed_article_field_partitioned DETACH PARTITION feed_article_field_partitioned_oldvalues;');
    
    // create new partitions by month
    for (const range of ranges) {
      const tableName = `feed_article_field_partitioned_y${range.from.slice(0, 4)}m${range.from.slice(5, 7)}`;
      this.addSql(`CREATE TABLE ${tableName} (LIKE feed_article_field_partitioned INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`);
      this.addSql(`INSERT INTO ${tableName} (SELECT * FROM feed_article_field_partitioned_oldvalues WHERE created_at >= '${range.from}' AND created_at < '${range.to}');`);
      this.addSql(`ALTER TABLE feed_article_field_partitioned ATTACH PARTITION ${tableName} FOR VALUES FROM ('${range.from}') TO ('${range.to}');`);
    }

    this.addSql(`DROP INDEX feed_article_field_partitioned_createdat_index`);
    this.addSql('DROP TABLE feed_article_field_partitioned_oldvalues;');
  }

  async down(): Promise<void> {
    this.addSql(`CREATE INDEX feed_article_field_partitioned_createdat_index ON feed_article_field_partitioned (created_at);`);

    this.addSql(`
      CREATE TABLE feed_article_field_partitioned_oldvalues (
        LIKE feed_article_field_partitioned INCLUDING DEFAULTS INCLUDING CONSTRAINTS
      );
    `)

    for (const range of ranges) {
      const tableName = `feed_article_field_partitioned_y${range.from.slice(0, 4)}m${range.from.slice(5, 7)}`;
      this.addSql(`INSERT INTO feed_article_field_partitioned_oldvalues (SELECT * FROM ${tableName});`);
      this.addSql(`ALTER TABLE feed_article_field_partitioned DETACH PARTITION ${tableName};`);
      this.addSql(`DROP TABLE ${tableName};`);
    }

    this.addSql(`
      ALTER TABLE feed_article_field_partitioned ATTACH PARTITION feed_article_field_partitioned_oldvalues
      FOR VALUES FROM ('${ranges[ranges.length - 1].from}') TO ('${ranges[0].to}');
    `)
  }
}
