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
  text?: string | null;

  @Property({
    nullable: true,
    type: 'bool',
    default: false,
  })
  hasCompressedText?: boolean;

  @Property()
  isCloudflare!: boolean;

  @Property({
    type: 'timestamp with time zone',
    nullable: true,
  })
  createdAt: Date = new Date();
}
