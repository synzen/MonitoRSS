import { Migration } from '@mikro-orm/migrations';

export class Migration20230804184025 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "request_response_id_index" on "request" ("response_id");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "request_response_id_index";');
  }

}
