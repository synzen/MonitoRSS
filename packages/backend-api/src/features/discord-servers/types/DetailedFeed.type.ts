import { Feed } from '../../feeds/entities/Feed.entity';

export enum DetailedFeedStatus {
  OK = 'ok',
  FAILED = 'failed',
}

export type DetailedFeed = Feed & {
  status: DetailedFeedStatus;
};
