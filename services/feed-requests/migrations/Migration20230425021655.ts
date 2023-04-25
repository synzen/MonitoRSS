import { Migration } from '@mikro-orm/migrations';

export class Migration20230425021655 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "request" alter column "url" type text using ("url"::text);');
  }

  async down(): Promise<void> {
    this.addSql('alter table "request" alter column "url" type varchar(255) using ("url"::varchar(255));');
  }

}
