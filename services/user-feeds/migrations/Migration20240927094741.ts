import { Migration } from '@mikro-orm/migrations';

export class Migration20240927094741 extends Migration {

  async up(): Promise<void> {
    this.addSql('DROP INDEX feed_article_field_partitioned_createdat_index;');
    this.addSql('DROP INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index;');
  }

  async down(): Promise<void> {
    this.addSql(`CREATE INDEX feed_article_field_partitioned_createdat_index ON feed_article_field_partitioned (created_at);`);
    this.addSql('CREATE UNIQUE INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value, created_at);');
  }

}
