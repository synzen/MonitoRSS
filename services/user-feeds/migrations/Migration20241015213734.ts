import { Migration } from '@mikro-orm/migrations';

export class Migration20241015213734 extends Migration {

  async up(): Promise<void> {
    this.addSql('CREATE INDEX feed_article_field_partitioned_id_name_value_created ON feed_article_field_partitioned (feed_id, field_name, field_hashed_value, created_at);');
    this.addSql('DROP INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index;');
  }

  async down(): Promise<void> {
    this.addSql('CREATE INDEX feed_article_field_partitioned_feedid_fieldname_fieldvalue_index ON feed_article_field_partitioned (feed_id, field_name, field_value);');
    this.addSql('DROP INDEX feed_article_field_partitioned_id_name_value_created;');
  }

}
