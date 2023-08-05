import { Migration } from '@mikro-orm/migrations';

export class Migration20230805105324 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" add column "created_at" timestamptz(0) null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response" drop column "created_at";');
  }

}
