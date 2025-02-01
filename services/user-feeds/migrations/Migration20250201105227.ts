import { Migration } from '@mikro-orm/migrations';

export class Migration20250201105227 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_parent_created_at_desc ON delivery_record_partitioned (feed_id, parent_id, created_at DESC);`);
    this.addSql(`DROP INDEX delivery_record_partitioned_feed_parent_created_at;`);
  }

  async down(): Promise<void> {
    this.addSql(`CREATE INDEX delivery_record_partitioned_feed_parent_created_at ON delivery_record_partitioned (feed_id, parent_id, created_at);`);
    this.addSql(`DROP INDEX delivery_record_partitioned_feed_parent_created_at_desc;`);
  }

}
