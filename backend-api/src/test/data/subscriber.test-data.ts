import { Types } from 'mongoose';
import {
  FeedSubscriber,
  FeedSubscriberType,
} from '../../features/feeds/entities/feed-subscriber.entity';

const boilerplate: FeedSubscriber = {
  _id: new Types.ObjectId(),
  feed: new Types.ObjectId(),
  id: 'id-1',
  type: FeedSubscriberType.ROLE,
  filters: {},
  rfilters: {},
};

export const createTestFeedSubscriber = (
  override?: Partial<FeedSubscriber>,
): FeedSubscriber => ({
  ...boilerplate,
  _id: new Types.ObjectId(),
  ...override,
});
