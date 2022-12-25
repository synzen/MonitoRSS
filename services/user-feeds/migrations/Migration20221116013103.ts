import { Migration } from "@mikro-orm/migrations";

export class Migration20221116013103 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "delivery_record" ("id" serial primary key, "feed_id" varchar(255) not null, "created_at" timestamptz(0) not null, "status" text check ("status" in (\'sent\', \'failed\', \'rejected\', \'filtered-out\', \'rate-limited\')) not null, "internal_message" varchar(255) null, "error_code" varchar(255) null);'
    );

    this.addSql(
      'create table "feed_article_field" ("id" serial primary key, "feed_id" varchar(255) not null, "field_name" varchar(255) not null, "field_value" varchar(255) not null, "created_at" timestamptz(0) not null);'
    );

    this.addSql(
      'create table "feed_article_custom_comparison" ("id" serial primary key, "feed_id" varchar(255) not null, "field_name" varchar(255) not null, "created_at" timestamptz(0) not null);'
    );
    this.addSql(
      'alter table "feed_article_custom_comparison" add constraint "unique_feed_field" unique ("feed_id", "field_name");'
    );

    this.addSql(
      'create table "feed_article_delivery_limit" ("id" serial primary key, "feed_id" varchar(255) not null, "limit" int not null, "time_window_seconds" int not null, "created_at" timestamptz(0) not null, "updated_at" timestamptz(0) not null);'
    );
    this.addSql(
      'alter table "feed_article_delivery_limit" add constraint "feed_article_delivery_limit_feed_id_time_window_seconds_unique" unique ("feed_id", "time_window_seconds");'
    );
  }
}
