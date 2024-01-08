import { Migration } from '@mikro-orm/migrations';

export class Migration20240106001547 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint if exists "delivery_record_status_check";');

    this.addSql('alter table "delivery_record" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_status_check" check ("status" in (\'pending-delivery\', \'sent\', \'failed\', \'rejected\', \'filtered-out\', \'rate-limited\', \'medium-rate-limited-by-user\'));');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint if exists "delivery_record_status_check";');

    this.addSql('alter table "delivery_record" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_status_check" check ("status" in (\'pending-delivery\', \'sent\', \'failed\', \'rejected\', \'filtered-out\', \'rate-limited\'));');
  }

}
