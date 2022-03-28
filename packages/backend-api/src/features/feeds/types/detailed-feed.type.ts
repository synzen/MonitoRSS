import { Feed } from '../entities/feed.entity';
import { FeedStatus } from './FeedStatus.type';

export interface DetailedFeed extends Feed {
  refreshRateSeconds: number;
  status: FeedStatus;
  failReason?: string;
  disabledReason?: string;
}
