import { Migration } from '@mikro-orm/migrations';

export class Migration20240118000049 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "created_at_index" on "request" ("created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "created_at_index";');
  }

}
