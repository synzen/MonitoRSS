import { Migration } from '@mikro-orm/migrations';

export class Migration20240926163057 extends Migration {

  async up(): Promise<void> {
    // Convert id column to text
    this.addSql(`
      ALTER TABLE feed_article_field_partitioned
      ALTER COLUMN id SET DATA TYPE TEXT;
    `)
  }
  
  async down(): Promise<void> {
    // Convert id column back to serial
    this.addSql(`
      ALTER TABLE feed_article_field_partitioned
      ALTER COLUMN id SET DATA TYPE SERIAL;
    `)
  }

}
