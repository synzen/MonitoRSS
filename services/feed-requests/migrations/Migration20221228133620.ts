/* eslint-disable max-len */
import { Migration } from '@mikro-orm/migrations';

export class Migration20221228133620 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table "request" alter column "error_message" type text using ("error_message"::text);',
    );
  }

  async down(): Promise<void> {
    this.addSql(
      'alter table "request" alter column "error_message" type varchar(255) using ("error_message"::varchar(255));',
    );
  }
}
