import { Migration } from '@mikro-orm/migrations';

export class Migration20230510235846 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" drop constraint if exists "request_status_check";');

    this.addSql('alter table "request" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "request" add constraint "request_status_check" check ("status" in (\'OK\', \'INTERNAL_ERROR\', \'FETCH_ERROR\', \'PARSE_ERROR\', \'BAD_STATUS_CODE\', \'FETCH_TIMEOUT\'));');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" drop constraint if exists "request_status_check";');

    this.addSql('alter table "request" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "request" add constraint "request_status_check" check ("status" in (\'OK\', \'INTERNAL_ERROR\', \'FETCH_ERROR\', \'PARSE_ERROR\', \'BAD_STATUS_CODE\'));');
  }

}
