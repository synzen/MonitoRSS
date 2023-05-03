import { Migration } from '@mikro-orm/migrations';

export class Migration20230503124806 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "article_property_index" on "feed_article_field" ("feed_id", "field_name", "field_value");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "article_property_index";');
  }

}
