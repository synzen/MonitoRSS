import { Migration } from '@mikro-orm/migrations';

export class Migration20240122233640 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "delivery_record_medium_id_article_id_hash_index" on "delivery_record" ("medium_id", "article_id_hash");');
    // delet all records where article id hash is null, or where there are duplicates that violates the unqiue constraint
    this.addSql('delete from "delivery_record" where article_id_hash is null;');
    this.addSql('delete from "delivery_record" a using "delivery_record" b where a.id < b.id and a.medium_id = b.medium_id and a.article_id_hash = b.article_id_hash;')
    this.addSql('drop index "delivery_record_medium_id_article_id_hash_index";');
    this.addSql('alter table "delivery_record" add constraint "delivery_record_medium_id_article_id_hash_unique" unique ("medium_id", "article_id_hash");');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop constraint "delivery_record_medium_id_article_id_hash_unique";');
  }

}
