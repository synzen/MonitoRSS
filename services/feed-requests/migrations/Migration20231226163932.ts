import { Migration } from '@mikro-orm/migrations';

export class Migration20231226163932 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" add column "lookup_key" text null;');
    this.addSql('update "request" set lookup_key = url;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop column "lookup_key";');
  }

}
