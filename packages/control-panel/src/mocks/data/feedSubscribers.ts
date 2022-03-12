import { FeedSubscriber } from '@/features/feed/types/FeedSubscriber';
import mockDiscordRoles from './discordRoles';
import mockFeeds from './feed';

const mockFeedSubscribers: FeedSubscriber[] = [{
  id: '1',
  type: 'role',
  discordId: mockDiscordRoles[0].id,
  feed: mockFeeds[0].id,
  filters: [],
}, {
  id: '2',
  type: 'role',
  discordId: mockDiscordRoles[1].id,
  feed: mockFeeds[0].id,
  filters: [],
}];

export default mockFeedSubscribers;
