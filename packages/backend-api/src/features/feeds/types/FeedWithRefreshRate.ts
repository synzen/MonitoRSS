import { Feed } from '../entities/Feed.entity';
import { FeedStatus } from './FeedStatus.type';

export interface FeedWithRefreshRate extends Feed {
  refreshRateSeconds: number;
  status: FeedStatus;
}
