import { Migration } from '@mikro-orm/migrations';

export class Migration20230913223924 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "feed_retry_record" ("id" serial primary key, "feed_id" varchar(255) not null, "attempts_so_far" int not null);');
    this.addSql('alter table "feed_retry_record" add constraint "feed_retry_record_feed_id_unique" unique ("feed_id");');
    this.addSql('create index "feed_id" on "feed_retry_record" ("feed_id");');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "feed_retry_record" cascade;');
  }

}
