import { Migration } from '@mikro-orm/migrations';

export class Migration20240926163057 extends Migration {

  async up(): Promise<void> {
    this.addSql(`
      INSERT INTO feed_article_field_partitioned (feed_id, field_name, field_hashed_value)
      SELECT feed_id, field_name, field_value FROM feed_article_field WHERE created_at > '2024-03-26 16:11:09.719+00'
      ON CONFLICT DO NOTHING;
    `)
  }
  
  async down(): Promise<void> {
    this.addSql('TRUNCATE feed_article_field_partitioned;');
  }

}
