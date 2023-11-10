import { Migration } from '@mikro-orm/migrations';

export class Migration20231110220805 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" drop column "text";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response" add column "text" text null;');
  }

}
