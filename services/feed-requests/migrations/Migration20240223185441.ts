import { Migration } from '@mikro-orm/migrations';

export class Migration20240223185441 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" add column "source" text check ("source" in (\'SHEDULE\')) null default null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop column "source";');
  }

}
