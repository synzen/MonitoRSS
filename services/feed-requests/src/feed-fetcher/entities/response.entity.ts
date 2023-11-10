import { Entity, Property, PrimaryKey } from '@mikro-orm/core';

@Entity()
export class Response {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number;

  @Property()
  statusCode!: number;

  @Property({
    nullable: true,
    type: 'text',
  })
  textHash?: string | null;

  @Property({
    nullable: true,
    type: 'bool',
    default: false,
  })
  hasCompressedText?: boolean;

  @Property()
  isCloudflare!: boolean;

  @Property({
    nullable: true,
    type: 'text',
    default: null,
  })
  s3ObjectKey?: string | null;

  @Property({
    nullable: true,
    type: 'text',
    default: null,
  })
  redisCacheKey?: string | null;

  @Property({
    type: 'json',
    nullable: true,
  })
  headers?: {
    etag?: string;
    lastModified?: string;
  } | null;

  @Property({
    type: 'timestamp with time zone',
    nullable: true,
  })
  createdAt: Date = new Date();
}
