import { Migration } from '@mikro-orm/migrations';

export class Migration20230819211324 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response_hash" alter column "updated_at" type timestamptz(0) using ("updated_at"::timestamptz(0));');
    this.addSql('alter table "response_hash" alter column "updated_at" set default \'now()\';');
    this.addSql('alter table "response_hash" drop column "created_at";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response_hash" add column "created_at" timestamptz(0) not null;');
    this.addSql('alter table "response_hash" alter column "updated_at" drop default;');
    this.addSql('alter table "response_hash" alter column "updated_at" type timestamptz(0) using ("updated_at"::timestamptz(0));');
  }

}
