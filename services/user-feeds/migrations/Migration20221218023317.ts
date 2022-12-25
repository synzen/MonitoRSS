import { Migration } from '@mikro-orm/migrations';

export class Migration20221218023317 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" add column "medium_id" varchar(255) not null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" drop column "medium_id";');
  }

}
