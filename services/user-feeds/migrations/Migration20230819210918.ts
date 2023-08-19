import { Migration } from '@mikro-orm/migrations';

export class Migration20230819210918 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response_hash" alter column "id" type int using ("id"::int);');
    this.addSql('alter table "response_hash" alter column "id" drop default;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response_hash" alter column "id" type int using ("id"::int);');
    this.addSql('create sequence if not exists "response_hash_id_seq";');
    this.addSql('select setval(\'response_hash_id_seq\', (select max("id") from "response_hash"));');
    this.addSql('alter table "response_hash" alter column "id" set default nextval(\'response_hash_id_seq\');');
  }

}
