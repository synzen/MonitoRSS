import { Migration } from '@mikro-orm/migrations';

export class Migration20231225183017 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" rename column "article_id" to "article_id_hash";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" rename column "article_id_hash" to "article_id";');
  }

}
