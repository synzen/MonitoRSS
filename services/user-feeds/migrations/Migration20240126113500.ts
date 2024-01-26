import { Migration } from '@mikro-orm/migrations';

export class Migration20240126113500 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint "delivery_record_medium_id_article_id_hash_unique";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" add constraint "delivery_record_medium_id_article_id_hash_unique" unique ("medium_id", "article_id_hash");');
  }

}
