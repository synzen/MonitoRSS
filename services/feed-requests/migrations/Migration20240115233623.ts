import { Migration } from '@mikro-orm/migrations';

export class Migration20240115233623 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" drop constraint "request_response_id_foreign";');

    this.addSql('alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete cascade;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop constraint "request_response_id_foreign";');

    this.addSql('alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete set null;');
  }

}
