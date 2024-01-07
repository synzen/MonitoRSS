import { Migration } from '@mikro-orm/migrations';

export class Migration20240107151859 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index "url_created_at_index";');
  }

  async down(): Promise<void> {
    this.addSql('create index "url_created_at_index" on "request" ("url", "created_at");');
  }

}
