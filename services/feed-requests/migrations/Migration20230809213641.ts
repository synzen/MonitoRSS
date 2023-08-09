import { Migration } from '@mikro-orm/migrations';

export class Migration20230809213641 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" add column "has_compressed_text" boolean null default false;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response" drop column "has_compressed_text";');
  }

}
