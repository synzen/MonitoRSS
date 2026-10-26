/* eslint-disable max-len */
// GENERATED FILE — do not edit by hand.
// Extracted verbatim from the legacy MikroORM migration classes in
// /migrations by scripts-tmp-extract-migrations.mjs during the standard-stack
// migration. Each entry's statements are the original addSql strings,
// unchanged.
//
// New migrations are appended to the MIGRATIONS list in migrations.ts.
export interface LegacyMigration {
  version: string;
  name: string;
  upStatements: string[];
  downStatements: string[];
}

export const LEGACY_MIGRATIONS: LegacyMigration[] = [
  {
    version: '20221225221749',
    name: 'Migration20221225221749',
    upStatements: [
      'create table "response" ("id" serial primary key, "status_code" int not null, "text" text null, "is_cloudflare" boolean not null);',
      'create table "request" ("id" serial primary key, "status" text check ("status" in (\'OK\', \'FAILED\', \'FETCH_ERROR\', \'PARSE_ERROR\')) not null, "fetch_options" jsonb null default null, "url" varchar(255) not null, "created_at" timestamptz(0) not null, "error_message" varchar(255) null, "response_id" int null);',
      'alter table "request" add constraint "request_response_id_unique" unique ("response_id");',
      'alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete set null;',
    ],
    downStatements: [
      'alter table "request" drop constraint "request_response_id_foreign";',
      'drop table if exists "response" cascade;',
      'drop table if exists "request" cascade;',
    ],
  },
  {
    version: '20221228133620',
    name: 'Migration20221228133620',
    upStatements: [
      'alter table "request" alter column "error_message" type text using ("error_message"::text);',
    ],
    downStatements: [
      'alter table "request" alter column "error_message" type varchar(255) using ("error_message"::varchar(255));',
    ],
  },
  {
    version: '20230101171007',
    name: 'Migration20230101171007',
    upStatements: [
      'alter table "request" add column "next_retry_date" timestamptz(0) null;',
    ],
    downStatements: ['alter table "request" drop column "next_retry_date";'],
  },
  {
    version: '20230110193859',
    name: 'Migration20230110193859',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      'update "request" set "status" = \'INTERNAL_ERROR\' where "status" = \'FAILED\'',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'FAILED', 'FETCH_ERROR', 'PARSE_ERROR'));",
    ],
  },
  {
    version: '20230425021655',
    name: 'Migration20230425021655',
    upStatements: [
      'alter table "request" alter column "url" type text using ("url"::text);',
    ],
    downStatements: [
      'alter table "request" alter column "url" type varchar(255) using ("url"::varchar(255));',
    ],
  },
  {
    version: '20230503122321',
    name: 'Migration20230503122321',
    upStatements: ['create index "url_index" on "request" ("url");'],
    downStatements: ['drop index "url_index";'],
  },
  {
    version: '20230503123738',
    name: 'Migration20230503123738',
    upStatements: [
      'drop index "url_index";',
      'create index "url_created_at_index" on "request" ("url", "created_at");',
    ],
    downStatements: [
      'drop index "url_created_at_index";',
      'create index "url_index" on "request" ("url");',
    ],
  },
  {
    version: '20230510235846',
    name: 'Migration20230510235846',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE'));",
    ],
  },
  {
    version: '20230804184025',
    name: 'Migration20230804184025',
    upStatements: [
      'create index "request_response_id_index" on "request" ("response_id");',
    ],
    downStatements: ['drop index "request_response_id_index";'],
  },
  {
    version: '20230805105324',
    name: 'Migration20230805105324',
    upStatements: [
      'alter table "response" add column "created_at" timestamptz(0) null;',
    ],
    downStatements: ['alter table "response" drop column "created_at";'],
  },
  {
    version: '20230809213641',
    name: 'Migration20230809213641',
    upStatements: [
      'alter table "response" add column "has_compressed_text" boolean null default false;',
    ],
    downStatements: [
      'alter table "response" drop column "has_compressed_text";',
    ],
  },
  {
    version: '20230810145203',
    name: 'Migration20230810145203',
    upStatements: [
      'alter table "response" add column "s3object_key" text null default null;',
    ],
    downStatements: ['alter table "response" drop column "s3object_key";'],
  },
  {
    version: '20230811222650',
    name: 'Migration20230811222650',
    upStatements: [
      'alter table "response" add column "redis_cache_key" text null default null;',
    ],
    downStatements: ['alter table "response" drop column "redis_cache_key";'],
  },
  {
    version: '20230817222734',
    name: 'Migration20230817222734',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT'));",
    ],
  },
  {
    version: '20230818124845',
    name: 'Migration20230818124845',
    upStatements: ['alter table "response" add column "text_hash" text null;'],
    downStatements: ['alter table "response" drop column "text_hash";'],
  },
  {
    version: '20231110134703',
    name: 'Migration20231110134703',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "response" add column "headers" jsonb null;',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'NOT_MODIFIED', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "response" drop column "headers";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED'));",
    ],
  },
  {
    version: '20231110152906',
    name: 'Migration20231110152906',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'NOT_MODIFIED', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH'));",
    ],
  },
  {
    version: '20231110220805',
    name: 'Migration20231110220805',
    upStatements: ['alter table "response" drop column "text";'],
    downStatements: ['alter table "response" add column "text" text null;'],
  },
  {
    version: '20231113160153',
    name: 'Migration20231113160153',
    upStatements: [
      'create index "status_code_index" on "response" ("status_code");',
    ],
    downStatements: ['drop index "status_code_index";'],
  },
  {
    version: '20231226163932',
    name: 'Migration20231226163932',
    upStatements: ['alter table "request" add column "lookup_key" text null;'],
    downStatements: ['alter table "request" drop column "lookup_key";'],
  },
  {
    version: '20231229131921',
    name: 'Migration20231229131921',
    upStatements: [
      'create index "lookupkey_created_at_index" on "request" ("lookup_key", "created_at");',
    ],
    downStatements: ['drop index "lookupkey_created_at_index";'],
  },
  {
    version: '20240107151859',
    name: 'Migration20240107151859',
    upStatements: ['drop index "url_created_at_index";'],
    downStatements: [
      'create index "url_created_at_index" on "request" ("url", "created_at");',
    ],
  },
  {
    version: '20240107155240',
    name: 'Migration20240107155240',
    upStatements: [
      'drop index "lookupkey_created_at_index";',
      'create index "lookupkey_created_at_status_index" on "request" ("lookup_key", "created_at", "status");',
    ],
    downStatements: [
      'drop index "lookupkey_created_at_status_index";',
      'create index "lookupkey_created_at_index" on "request" ("lookup_key", "created_at");',
    ],
  },
  {
    version: '20240115233623',
    name: 'Migration20240115233623',
    upStatements: [
      'alter table "request" drop constraint "request_response_id_foreign";',
      'alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete cascade;',
    ],
    downStatements: [
      'alter table "request" drop constraint "request_response_id_foreign";',
      'alter table "request" add constraint "request_response_id_foreign" foreign key ("response_id") references "response" ("id") on update cascade on delete set null;',
    ],
  },
  {
    version: '20240118000049',
    name: 'Migration20240118000049',
    upStatements: [
      'create index "created_at_index" on "request" ("created_at");',
    ],
    downStatements: ['drop index "created_at_index";'],
  },
  {
    version: '20240118234031',
    name: 'Migration20240118234031',
    upStatements: [
      'create index "created_atindex" on "response" ("created_at");',
      'drop index "created_at_index";',
    ],
    downStatements: [
      'drop index "createdat_index";',
      'create index "created_at_index" on "request" ("created_at");',
    ],
  },
  {
    version: '20240119125139',
    name: 'Migration20240119125139',
    upStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH', 'INVALID_SSL_CERTIFICATE'));",
    ],
    downStatements: [
      'alter table "request" drop constraint if exists "request_status_check";',
      'alter table "request" alter column "status" type text using ("status"::text);',
      "alter table \"request\" add constraint \"request_status_check\" check (\"status\" in ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH'));",
    ],
  },
  {
    version: '20240223185441',
    name: 'Migration20240223185441',
    upStatements: [
      'alter table "request" add column "source" text check ("source" in (\'SHEDULE\')) null default null;',
    ],
    downStatements: ['alter table "request" drop column "source";'],
  },
  {
    version: '20240921161902',
    name: 'Migration20240921161902',
    upStatements: [
      "CREATE TYPE request_partitioned_status AS ENUM ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH', 'INVALID_SSL_CERTIFICATE');",
      "CREATE TYPE request_partitioned_source AS ENUM ('SHEDULE');",
      'CREATE TABLE request_partitioned (\n      id SERIAL NOT NULL,\n      status request_partitioned_status NOT NULL,\n      source request_partitioned_source DEFAULT NULL NULL,\n      fetch_options JSON DEFAULT NULL NULL,\n      url TEXT NOT NULL,\n      url_hash TEXT DEFAULT NULL NULL,\n      lookup_key TEXT DEFAULT NULL NULL,\n      created_at TIMESTAMPTZ DEFAULT now() NOT NULL,\n      next_retry_date TIMESTAMPTZ DEFAULT NULL NULL,\n      error_message TEXT DEFAULT NULL NULL,\n      response_status_code INT DEFAULT NULL NULL,\n      response_text_hash TEXT DEFAULT NULL NULL,\n      response_s3object_key TEXT DEFAULT NULL NULL,\n      response_redis_cache_key TEXT DEFAULT NULL NULL,\n      response_headers JSON DEFAULT NULL NULL\n      ) PARTITION BY RANGE (created_at);',
      "CREATE TABLE request_partitioned_oldvalues PARTITION OF request_partitioned FOR VALUES FROM ('2022-09-21 16:19:02') TO ('2024-09-21 00:00:00');",
      "CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01 00:00:00');",
      "CREATE TABLE request_partitioned_y2024m11 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01 00:00:00') TO ('2024-11-01 00:00:00');",
      'ALTER TABLE request_partitioned ADD PRIMARY KEY (id, created_at);',
      'CREATE INDEX request_partitioned_createdat_index ON request_partitioned (created_at);',
      'CREATE INDEX request_partitioned_status_code_index ON request_partitioned (response_status_code);',
      'CREATE INDEX request_partitioned_lookupkey_created_at_status_index ON request_partitioned (lookup_key, created_at, status);',
    ],
    downStatements: ['DROP TABLE request_partitioned;'],
  },
  {
    version: '20240922184038',
    name: 'Migration20240922184038',
    upStatements: [
      'DROP TABLE request_partitioned_y2024m10;',
      'DROP TABLE request_partitioned_y2024m11;',
      "CREATE TABLE request_partitioned_y2024m09 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01T00:00:00.000Z');",
      "CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01T00:00:00.000Z') TO ('2024-11-01T00:00:00.000Z');",
    ],
    downStatements: [
      'DROP TABLE request_partitioned_y2024m09;',
      "CREATE TABLE request_partitioned_y2024m10 PARTITION OF request_partitioned FOR VALUES FROM ('2024-09-21 00:00:00') TO ('2024-10-01 00:00:00');",
      "CREATE TABLE request_partitioned_y2024m11 PARTITION OF request_partitioned FOR VALUES FROM ('2024-10-01 00:00:00') TO ('2024-11-01 00:00:00');",
    ],
  },
  {
    version: '20240929220820',
    name: 'Migration20240929220820',
    upStatements: [
      'ALTER TABLE request_partitioned ALTER COLUMN id TYPE TEXT;',
    ],
    downStatements: [
      'ALTER TABLE request_partitioned ALTER COLUMN id TYPE INT USING id::int;',
    ],
  },
  {
    version: '20241101102225',
    name: 'Migration20241101102225',
    upStatements: ['DROP TABLE IF EXISTS request_partitioned_y2024m11;'],
    downStatements: [],
  },
  {
    version: '20241202231256',
    name: 'Migration20241202231256',
    upStatements: [
      'ALTER TABLE request_partitioned ADD COLUMN host_hash TEXT DEFAULT NULL',
    ],
    downStatements: [
      'ALTER TABLE request_partitioned DROP COLUMN host_hash TEXT DEFAULT NULL',
    ],
  },
  {
    version: '20250102112346',
    name: 'Migration20250102112346',
    upStatements: [
      'CREATE TABLE "response_bodies" ("content" TEXT NOT NULL, "hash_key" TEXT NOT NULL);',
      'CREATE UNIQUE INDEX "response_bodies_hash_key" ON "response_bodies" ("hash_key");',
      'ALTER TABLE "request_partitioned" ADD COLUMN "response_body_hash_key" TEXT DEFAULT NULL NULL;',
      'ALTER TABLE "request_partitioned" ADD CONSTRAINT "request_partitioned_response_body_hash_key_fk" FOREIGN KEY ("response_body_hash_key") REFERENCES "response_bodies" ("hash_key") ON DELETE SET NULL;',
    ],
    downStatements: [
      'DROP TABLE "response_bodies";',
      'ALTER TABLE "request_partitioned" DROP COLUMN "response_body_hash_key";',
    ],
  },
  {
    version: '20250102220055',
    name: 'Migration20250102220055',
    upStatements: [
      'ALTER TABLE "response_bodies" ADD COLUMN "content_hash" TEXT DEFAULT NULL NULL;',
    ],
    downStatements: [
      'ALTER TABLE "response_bodies" DROP COLUMN "content_hash";',
    ],
  },
  {
    version: '20250105152132',
    name: 'Migration20250105152132',
    upStatements: [
      'ALTER TABLE request_partitioned ADD COLUMN request_initiated_at TIMESTAMPTZ DEFAULT NULL NULL;',
    ],
    downStatements: [
      'ALTER TABLE request_partitioned DROP COLUMN request_initiated_at;',
    ],
  },
];
