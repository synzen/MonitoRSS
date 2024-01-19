import { Migration } from '@mikro-orm/migrations';

export class Migration20240118234031 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "created_atindex" on "response" ("created_at");');

    this.addSql('drop index "created_at_index";');
  }

  async down(): Promise<void> {
    this.addSql('drop index "createdat_index";');

    this.addSql('create index "created_at_index" on "request" ("created_at");');
  }

}
