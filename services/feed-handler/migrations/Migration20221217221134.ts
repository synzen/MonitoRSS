import { Migration } from '@mikro-orm/migrations';

export class Migration20221217221134 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint if exists "delivery_record_status_check";');

    this.addSql('alter table "delivery_record" alter column "id" type varchar(255) using ("id"::varchar(255));');
    this.addSql('alter table "delivery_record" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_status_check" check ("status" in (\'pending-delivery\', \'sent\', \'failed\', \'rejected\', \'filtered-out\', \'rate-limited\'));');
    this.addSql('alter table "delivery_record" alter column "id" drop default;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint if exists "delivery_record_status_check";');

    this.addSql('alter table "delivery_record" alter column "id" type int using ("id"::int);');
    this.addSql('alter table "delivery_record" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_status_check" check ("status" in (\'sent\', \'failed\', \'rejected\', \'filtered-out\', \'rate-limited\'));');
    this.addSql('create sequence if not exists "delivery_record_id_seq";');
    this.addSql('select setval(\'delivery_record_id_seq\', (select max("id") from "delivery_record"));');
    this.addSql('alter table "delivery_record" alter column "id" set default nextval(\'delivery_record_id_seq\');');
  }

}
