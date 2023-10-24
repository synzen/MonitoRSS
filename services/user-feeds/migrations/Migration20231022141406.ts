import { Migration } from '@mikro-orm/migrations';

export class Migration20231022141406 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" add column "external_detail" text null default null, add column "article_id" text null default null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop column "external_detail";');
    this.addSql('alter table "delivery_record" drop column "article_id";');
  }

}
