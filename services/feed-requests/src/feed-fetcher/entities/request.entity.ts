import { RequestFetchOptions, RequestStatus } from '../constants';
import { RequestSource } from '../constants/request-source.constants';
import { Response } from './response.entity';
import {
  Entity,
  PrimaryKey,
  Enum,
  Property,
  OneToOne,
  Index,
} from '@mikro-orm/core';

@Entity()
@Index({
  properties: ['lookupKey', 'createdAt', 'status'],
  name: 'lookupkey_created_at_status_index',
})
export class Request {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number;

  @Enum(() => RequestStatus)
  status!: RequestStatus;

  @Enum({ items: () => RequestSource, nullable: true, default: null })
  source?: string | null;

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
    type: 'text',
    nullable: true,
  })
  lookupKey!: string | null;

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
    index: true,
    onDelete: 'cascade',
  })
  response!: Response | null;
}
