import { Migration } from '@mikro-orm/migrations';

export class Migration20231226195925 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "delivery_timeframe_medium_count_index" on "delivery_record" ("medium_id", "status", "created_at");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "delivery_timeframe_medium_count_index";');
  }

}
