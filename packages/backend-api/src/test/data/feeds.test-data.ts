import { Feed } from '../../features/feeds/entities/Feed.entity';
import { Types } from 'mongoose';

const boilerplate: Feed = {
  _id: new Types.ObjectId(),
  channel: 'channel-1',
  guild: 'guild-1',
  title: 'title-1',
  url: 'url-1',
  text: 'text-1',
  addedAt: new Date(),
  embeds: [],
};

export const createTestFeed = (override?: Partial<Feed>): Feed => ({
  ...boilerplate,
  _id: new Types.ObjectId(),
  ...override,
});
