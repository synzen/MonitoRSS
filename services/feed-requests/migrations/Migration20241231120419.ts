import { Migration } from '@mikro-orm/migrations';

export class Migration20241231120419 extends Migration {

  async up(): Promise<void> {
    this.addSql(`ALTER TYPE request_partitioned_status ADD VALUE 'CACHE_CONTROL_SKIPPED';`);
    // switch the created_at and status of the index
    this.addSql(`DROP INDEX request_partitioned_lookupkey_created_at_status_index;`);
    this.addSql(`CREATE INDEX request_partitioned_lookupkey_status_created_at_index ON request_partitioned (lookup_key, status, created_at);`);
  }

  async down(): Promise<void> {
    this.addSql(`ALTER TYPE request_partitioned_status DROP VALUE 'CACHE_CONTROL_SKIPPED';`);
    // switch the created_at and status of the index
    this.addSql(`DROP INDEX request_partitioned_lookupkey_status_created_at_index;`);
    this.addSql(`CREATE INDEX request_partitioned_lookupkey_created_at_status_index ON request_partitioned (lookup_key, created_at, status);`);
  }

}
