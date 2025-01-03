import { Migration } from '@mikro-orm/migrations';

export class Migration20250102220055 extends Migration {

  async up(): Promise<void> {
    // add column content_hash to response_bodies
    this.addSql('ALTER TABLE "response_bodies" ADD COLUMN "content_hash" TEXT DEFAULT NULL NULL;');
  }

  async down(): Promise<void> {
    // drop column content_hash from response_bodies
    this.addSql('ALTER TABLE "response_bodies" DROP COLUMN "content_hash";');
  }

}
