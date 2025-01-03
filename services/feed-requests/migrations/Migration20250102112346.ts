import { Migration } from '@mikro-orm/migrations';

export class Migration20250102112346 extends Migration {

  async up(): Promise<void> {
    // create table response_bodies with auto increment id, text column "body" and hash_key column "hash_key"
    this.addSql('CREATE TABLE "response_bodies" ("content" TEXT NOT NULL, "hash_key" TEXT NOT NULL);');
    // create index on hash_key column
    this.addSql('CREATE UNIQUE INDEX "response_bodies_hash_key" ON "response_bodies" ("hash_key");');

    // add column response_body_hash_key to request_partitioned
    this.addSql('ALTER TABLE "request_partitioned" ADD COLUMN "response_body_hash_key" TEXT DEFAULT NULL NULL;');
    // add foreign key constraint to response_body_hash_key column
    this.addSql(`ALTER TABLE "request_partitioned" ADD CONSTRAINT "request_partitioned_response_body_hash_key_fk" FOREIGN KEY ("response_body_hash_key") REFERENCES "response_bodies" ("hash_key") ON DELETE SET NULL;`);
  }

  async down(): Promise<void> {
    // drop table response_bodies
    this.addSql('DROP TABLE "response_bodies";');
    // drop column response_body_hash_key from request_partitioned
    this.addSql('ALTER TABLE "request_partitioned" DROP COLUMN "response_body_hash_key";');
  }

}
