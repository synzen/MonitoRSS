/* eslint-disable max-len */
import { Migration } from '@mikro-orm/migrations';

export class Migration20221225221749 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "response" ("id" serial primary key, "status_code" int not null, "text" text null, "is_cloudflare" boolean not null);',
    );

    this.addSql(
      'create table "request" ("id" serial primary key, "status" text check ("status" in (\'OK\', \'FAILED\', \'FETCH_ERROR\', \'PARSE_ERROR\')) not null, "fetch_options" jsonb null default null, "url" varchar(255) not null, "created_at" timestamptz(0) not null, "error_message" varchar(255) null, "response_id" int null);',
    );
    this.addSql(
      'alter table "request" add constraint "request_response_id_unique" unique ("response_id");',
    );

    this.addSql(
      'alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete set null;',
    );
  }

  async down(): Promise<void> {
    this.addSql(
      'alter table "request" drop constraint "request_response_id_foreign";',
    );

    this.addSql('drop table if exists "response" cascade;');

    this.addSql('drop table if exists "request" cascade;');
  }
}
