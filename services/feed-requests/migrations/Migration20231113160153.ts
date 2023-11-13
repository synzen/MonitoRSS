import { Migration } from '@mikro-orm/migrations';

export class Migration20231113160153 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "status_code_index" on "response" ("status_code");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "status_code_index";');
  }

}
