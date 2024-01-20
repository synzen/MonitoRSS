import { Migration } from '@mikro-orm/migrations';

export class Migration20240120215200 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "feed_parent_created_at_index" on "delivery_record" ("feed_id", "parent_id", "created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "feed_parent_created_at_index";');
  }

}
