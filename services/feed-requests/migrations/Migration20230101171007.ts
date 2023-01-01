import { Migration } from '@mikro-orm/migrations';

export class Migration20230101171007 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" add column "next_retry_date" timestamptz(0) null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop column "next_retry_date";');
  }

}
