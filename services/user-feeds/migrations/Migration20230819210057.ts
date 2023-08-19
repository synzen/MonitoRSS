import { Migration } from '@mikro-orm/migrations';

export class Migration20230819210057 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "response_hash" ("id" varchar(255) not null, "feed_id" varchar(255) not null, "hash" varchar(255) not null, "created_at" timestamptz(0) not null, "updated_at" timestamptz(0) not null, constraint "response_hash_pkey" primary key ("id"));');
    this.addSql('alter table "response_hash" add constraint "unique_feed_id" unique ("feed_id");');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "response_hash" cascade;');
  }

}
