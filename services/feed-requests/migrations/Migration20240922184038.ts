import { Migration } from '@mikro-orm/migrations';

export class Migration20240922184038 extends Migration {

  async up(): Promise<void> {
    this.addSql('DROP TABLE request_partitioned_y2024m10;');
    this.addSql('DROP TABLE request_partitioned_y2024m11;');
    this.addSql(`CREATE TABLE request_partitioned_y2024m09 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01T00:00:00.000Z');`);
    this.addSql(`CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01T00:00:00.000Z') TO ('2024-11-01T00:00:00.000Z');`);
  }


  async down(): Promise<void> {
    this.addSql('DROP TABLE request_partitioned_y2024m09;');
    this.addSql(`CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01 00:00:00');`);
    this.addSql(`CREATE TABLE request_partitioned_y2024m11 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01 00:00:00') TO ('2024-11-01 00:00:00');`);
  }
}
