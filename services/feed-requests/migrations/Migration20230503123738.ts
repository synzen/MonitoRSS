import { Migration } from '@mikro-orm/migrations';

export class Migration20230503123738 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index "url_index";');
    this.addSql('create index "url_created_at_index" on "request" ("url", "created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "url_created_at_index";');
    this.addSql('create index "url_index" on "request" ("url");');
  }

}
