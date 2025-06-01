import { Migration } from "@mikro-orm/migrations";

export class Migration20250601174744 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE delivery_record_partitioned ADD COLUMN IF NOT EXISTS article_data JSON NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE delivery_record_partitioned DROP COLUMN IF EXISTS article_data;`
    );
  }
}
