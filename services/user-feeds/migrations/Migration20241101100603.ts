import { Migration } from '@mikro-orm/migrations';

export class Migration20241101100603 extends Migration {

  async up(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS feed_article_field_partitioned_y2024m11;');
    this.addSql('DROP TABLE IF EXISTS feed_article_field_partitioned_y2024m12;');
  }

}
