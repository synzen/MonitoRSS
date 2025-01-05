import { Migration } from '@mikro-orm/migrations';

export class Migration20250105152132 extends Migration {

  async up(): Promise<void> {
    // add request_initiated_at
    this.addSql('ALTER TABLE request_partitioned ADD COLUMN request_initiated_at TIMESTAMPTZ DEFAULT NULL NULL;');
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE request_partitioned DROP COLUMN request_initiated_at;');
  }

}
