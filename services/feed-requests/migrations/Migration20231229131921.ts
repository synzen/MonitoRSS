import { Migration } from '@mikro-orm/migrations';

export class Migration20231229131921 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "lookupkey_created_at_index" on "request" ("lookup_key", "created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "lookupkey_created_at_index";');
  }

}
