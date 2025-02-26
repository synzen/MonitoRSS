import { Migration } from "@mikro-orm/migrations";

export class Migration20250225140642 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `DROP INDEX delivery_record_partitioned_feed_parent_created_at_desc;`
    );
    this.addSql(
      `CREATE INDEX delivery_record_partitioned_feed_parent_created_at_desc ON delivery_record_partitioned (feed_id, created_at DESC, parent_id);`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `DROP INDEX delivery_record_partitioned_feed_parent_created_at_desc;`
    );
    this.addSql(
      `CREATE INDEX delivery_record_partitioned_feed_parent_created_at_desc ON delivery_record_partitioned (feed_id, parent_id, created_at DESC);`
    );
  }
}
