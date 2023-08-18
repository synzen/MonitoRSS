import { Migration } from '@mikro-orm/migrations';

export class Migration20230818124845 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" add column "text_hash" text null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response" drop column "text_hash";');
  }

}
