import { RequestFetchOptions, RequestStatus } from '../constants';
import { Response } from './response.entity';
import { Entity, PrimaryKey, Enum, Property, OneToOne } from '@mikro-orm/core';

@Entity()
export class Request {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number;

  @Enum(() => RequestStatus)
  status!: RequestStatus;

  @Property({
    nullable: true,
    default: null,
    type: 'jsonb',
  })
  fetchOptions?: RequestFetchOptions | null;

  @Property({
    type: 'text',
  })
  url!: string;

  @Property({
    type: 'timestamp with time zone',
  })
  createdAt: Date = new Date();

  /**
   * Should be defined when handling fetch request broker events, and requests failed.
   */
  @Property({
    nullable: true,
    type: 'timestamp with time zone',
  })
  nextRetryDate!: Date | null;

  @Property({
    nullable: true,
    type: 'text',
  })
  errorMessage?: string;

  @OneToOne({
    nullable: true,
    entity: () => Response,
  })
  response!: Response | null;
}
