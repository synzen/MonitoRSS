import { Migration } from '@mikro-orm/migrations';

export class Migration20230121145000 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "feed_article_field" alter column "field_value" type text using ("field_value"::text);');
  }

  async down(): Promise<void> {
    this.addSql('alter table "feed_article_field" alter column "field_value" type varchar(255) using ("field_value"::varchar(255));');
  }

}
