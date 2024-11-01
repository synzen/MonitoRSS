import { Migration } from '@mikro-orm/migrations';

export class Migration20241101102225 extends Migration {

  async up(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS request_partitioned_y2024m11;');
  }

  async down(): Promise<void> {
  }

}
