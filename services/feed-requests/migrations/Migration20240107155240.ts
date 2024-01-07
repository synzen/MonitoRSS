import { Migration } from '@mikro-orm/migrations';

export class Migration20240107155240 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index "lookupkey_created_at_index";');
    this.addSql('create index "lookupkey_created_at_status_index" on "request" ("lookup_key", "created_at", "status");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "lookupkey_created_at_status_index";');
    this.addSql('create index "lookupkey_created_at_index" on "request" ("lookup_key", "created_at");');
  }

}
