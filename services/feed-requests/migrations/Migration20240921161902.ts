import { Migration } from '@mikro-orm/migrations';

export class Migration20240921161902 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TYPE request_partitioned_status AS ENUM ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH', 'INVALID_SSL_CERTIFICATE');`);
    this.addSql(`CREATE TYPE request_partitioned_source AS ENUM ('SHEDULE');`);
    this.addSql(`CREATE TABLE request_partitioned (
      id SERIAL NOT NULL,
      status request_partitioned_status NOT NULL,
      source request_partitioned_source DEFAULT NULL NULL,
      fetch_options JSON DEFAULT NULL NULL,
      url TEXT NOT NULL,
      url_hash TEXT DEFAULT NULL NULL,
      lookup_key TEXT DEFAULT NULL NULL,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
      next_retry_date TIMESTAMPTZ DEFAULT NULL NULL,
      error_message TEXT DEFAULT NULL NULL,
      response_status_code INT DEFAULT NULL NULL,
      response_text_hash TEXT DEFAULT NULL NULL,
      response_s3object_key TEXT DEFAULT NULL NULL,
      response_redis_cache_key TEXT DEFAULT NULL NULL,
      response_headers JSON DEFAULT NULL NULL
      ) PARTITION BY RANGE (created_at);`);

    this.addSql(`CREATE TABLE request_partitioned_oldvalues PARTITION OF request_partitioned FOR VALUES FROM ('2022-09-21 16:19:02') TO ('2024-09-21 00:00:00');`);
    this.addSql(`CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01 00:00:00');`);
    this.addSql(`CREATE TABLE request_partitioned_y2024m11 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01 00:00:00') TO ('2024-11-01 00:00:00');`);

    this.addSql(`ALTER TABLE request_partitioned ADD PRIMARY KEY (id, created_at);`);
    this.addSql(`CREATE INDEX request_partitioned_createdat_index ON request_partitioned (created_at);`);
    this.addSql(`CREATE INDEX request_partitioned_status_code_index ON request_partitioned (response_status_code);`);
    this.addSql(`CREATE INDEX request_partitioned_lookupkey_created_at_status_index ON request_partitioned (lookup_key, created_at, status);`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE request_partitioned;`);
  }

}
