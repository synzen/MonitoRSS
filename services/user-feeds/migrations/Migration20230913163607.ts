import { Migration } from '@mikro-orm/migrations';

export class Migration20230913163607 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "feed_article_field" add column "is_hashed" boolean not null default false;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "feed_article_field" drop column "is_hashed";');
  }

}
