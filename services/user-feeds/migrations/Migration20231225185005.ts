import { Migration } from '@mikro-orm/migrations';

export class Migration20231225185005 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" add column "article_id" text null default null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop column "article_id";');
  }

}
