import { Feed } from '../entities/Feed.entity';
import { FeedStatus } from './FeedStatus.type';

export interface DetailedFeed extends Feed {
  refreshRateSeconds: number;
  status: FeedStatus;
  failReason?: string;
}
