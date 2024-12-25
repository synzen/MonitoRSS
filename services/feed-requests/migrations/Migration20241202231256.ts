import { Migration } from '@mikro-orm/migrations';

export class Migration20241202231256 extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE request_partitioned ADD COLUMN host_hash TEXT DEFAULT NULL');
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE request_partitioned DROP COLUMN host_hash TEXT DEFAULT NULL');
  }
}
