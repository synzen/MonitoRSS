import { Migration } from '@mikro-orm/migrations';

export class Migration20230811222650 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "response" add column "redis_cache_key" text null default null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "response" drop column "redis_cache_key";');
  }

}
