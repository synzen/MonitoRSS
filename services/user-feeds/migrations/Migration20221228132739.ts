import { Migration } from '@mikro-orm/migrations';

export class Migration20221228132739 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "delivery_record" alter column "internal_message" type text using ("internal_message"::text);');
  }

  async down(): Promise<void> {
    this.addSql('alter table "delivery_record" alter column "internal_message" type varchar using ("internal_message"::varchar);');
  }

}
