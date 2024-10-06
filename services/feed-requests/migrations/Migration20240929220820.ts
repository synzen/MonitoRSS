import { Migration } from '@mikro-orm/migrations';

export class Migration20240929220820 extends Migration {

  async up(): Promise<void> {
    this.addSql('ALTER TABLE request_partitioned ALTER COLUMN id TYPE TEXT;');
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE request_partitioned ALTER COLUMN id TYPE INT USING id::int;');
  }
}
