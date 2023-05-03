import { Migration } from '@mikro-orm/migrations';

export class Migration20230503122321 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "url_index" on "request" ("url");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "url_index";');
  }

}
