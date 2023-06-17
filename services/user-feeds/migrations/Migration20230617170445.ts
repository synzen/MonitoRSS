import { Migration } from '@mikro-orm/migrations';

export class Migration20230617170445 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" add column "content_type" text check ("content_type" in (\'discord-article-message\', \'discord-thread-creation\')) null, add column "parent_id" varchar(255) null default null;');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_parent_id_foreign" foreign key ("parent_id") references "delivery_record" ("id") on update cascade on delete set null;');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_parent_id_unique" unique ("parent_id");');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint "delivery_record_parent_id_foreign";');

    this.addSql('alter table "delivery_record" drop constraint "delivery_record_parent_id_unique";');
    this.addSql('alter table "delivery_record" drop column "content_type";');
    this.addSql('alter table "delivery_record" drop column "parent_id";');
  }

}
