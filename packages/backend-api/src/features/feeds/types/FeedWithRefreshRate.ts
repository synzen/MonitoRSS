import { Feed } from '../entities/Feed.entity';

export interface FeedWithRefreshRate extends Feed {
  refreshRateSeconds: number;
}
