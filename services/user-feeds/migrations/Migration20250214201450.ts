import { Migration } from '@mikro-orm/migrations';

export class Migration20250214201450 extends Migration {

  async up(): Promise<void> {
    this.addSql(`DROP INDEX delivery_record_partitioned_feed_timeframe_count;`);
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_timeframe_count ON delivery_record_partitioned (created_at DESC, feed_id, status);`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX delivery_record_partitioned_feed_timeframe_count;`);
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_timeframe_count ON delivery_record_partitioned (created_at, status, feed_id);`);
  }

}
