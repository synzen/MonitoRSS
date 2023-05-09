import { Migration } from '@mikro-orm/migrations';

export class Migration20230503161458 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "delivery_timeframe_count_index" on "delivery_record" ("feed_id", "status", "created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "delivery_timeframe_count_index";');
  }

}
