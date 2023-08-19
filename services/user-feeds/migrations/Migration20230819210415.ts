import { Migration } from '@mikro-orm/migrations';

export class Migration20230819210415 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response_hash" alter column "id" type int using ("id"::int);');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response_hash" alter column "id" type varchar(255) using ("id"::varchar(255));');
  }

}
