import { Migration } from '@mikro-orm/migrations';

export class Migration20230810145203 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" add column "s3object_key" text null default null;');
  }
  
  async down(): Promise<void> {
    this.addSql('alter table "response" drop column "s3object_key";');
  }

}
