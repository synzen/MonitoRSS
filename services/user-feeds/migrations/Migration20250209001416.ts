import { Migration } from '@mikro-orm/migrations';

export class Migration20250209001416 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "feed_retry_record" add column "created_at" timestamptz(0) null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "feed_retry_record" drop column "created_at";');
  }

}
