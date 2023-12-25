import { Migration } from '@mikro-orm/migrations';

export class Migration20231225185358 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "article_id_hash_index" on "delivery_record" ("article_id_hash");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "article_id_hash_index";');
  }

}
