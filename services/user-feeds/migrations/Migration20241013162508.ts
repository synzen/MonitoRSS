import { Migration } from '@mikro-orm/migrations';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const nextMonth = dayjs().utc().add(1, 'month').startOf('month')
const thisMonth = dayjs().utc().startOf('month')
const oneMonthAgo  = dayjs().utc().subtract(1, 'month').startOf('month')
const twoMonthsAgo = dayjs().utc().subtract(2, 'month').startOf('month')
const threeMonthsAgo = dayjs().utc().subtract(3, 'month').startOf('month')
const fourMonthsAgo = dayjs().utc().subtract(4, 'month').startOf('month')
const fiveMonthsAgo = dayjs().utc().subtract(5, 'month').startOf('month')


const ranges = [
  {
    from: thisMonth.toISOString(),
    to: nextMonth.toISOString(),
    tableName: `feed_article_field_partitioned_y${thisMonth.year()}m${thisMonth.month() + 1}`,
  },
  {
    from: oneMonthAgo.toISOString(),
    to: thisMonth.toISOString(),
    tableName: `feed_article_field_partitioned_y${oneMonthAgo.year()}m${oneMonthAgo.month() + 1}`,
  },
  {
    from: twoMonthsAgo.toISOString(),
    to: oneMonthAgo.toISOString(),
    tableName: `feed_article_field_partitioned_y${twoMonthsAgo.year()}m${twoMonthsAgo.month() + 1}`,
  },
  {
    from: threeMonthsAgo.toISOString(),
    to: twoMonthsAgo.toISOString(),
    tableName: `feed_article_field_partitioned_y${threeMonthsAgo.year()}m${threeMonthsAgo.month() + 1}`,
  },
  {
    from: fourMonthsAgo.toISOString(),
    to: threeMonthsAgo.toISOString(),
    tableName: `feed_article_field_partitioned_y${fourMonthsAgo.year()}m${fourMonthsAgo.month() + 1}`,
  },
  {
    from: fiveMonthsAgo.toISOString(),
    to: fourMonthsAgo.toISOString(),
    tableName: `feed_article_field_partitioned_y${fiveMonthsAgo.year()}m${fiveMonthsAgo.month() + 1}`,
  },
]

export class Migration20241013162508 extends Migration {

  async up(): Promise<void> {
    // detach feed_article_field_partitioned_oldvalues
    this.addSql('ALTER TABLE feed_article_field_partitioned DETACH PARTITION feed_article_field_partitioned_oldvalues;');
    
    // create new partitions by month
    for (const range of ranges) {
      const tableName = range.tableName
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
      const tableName = range.tableName
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
