import { Migration } from '@mikro-orm/migrations';

export class Migration20230110193859 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" drop constraint if exists "request_status_check";');
    this.addSql('alter table "request" alter column "status" type text using ("status"::text);');
    this.addSql('update "request" set "status" = \'INTERNAL_ERROR\' where "status" = \'FAILED\'');
    this.addSql('alter table "request" add constraint "request_status_check" check ("status" in (\'OK\', \'INTERNAL_ERROR\', \'FETCH_ERROR\', \'PARSE_ERROR\', \'BAD_STATUS_CODE\'));');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop constraint if exists "request_status_check";');
    this.addSql('alter table "request" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "request" add constraint "request_status_check" check ("status" in (\'OK\', \'FAILED\', \'FETCH_ERROR\', \'PARSE_ERROR\'));');
  }

}
