import { Feed } from '../../feeds/entities/Feed.entity';
import { FeedStatus } from '../../feeds/types/FeedStatus.type';

export interface DetailedFeed extends Feed {
  status: FeedStatus;
}
