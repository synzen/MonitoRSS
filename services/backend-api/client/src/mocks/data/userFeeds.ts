import { UserFeed } from '@/features/feed';
import { UserFeedDisabledCode, UserFeedHealthStatus } from '../../features/feed/types';
import { FeedConnectionType } from '../../types';
import mockDiscordChannels from './discordChannels';
import mockDiscordWebhooks from './discordWebhooks';

const mockUserFeeds: UserFeed[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  connections: [{
    details: {
      channel: {
        id: mockDiscordChannels[0].id,
      },
      embeds: [],
    },
    filters: null,
    id: '1',
    key: FeedConnectionType.DiscordChannel,
    name: 'Discord Channel 1',
  }, {
    details: {
      embeds: [],
      webhook: {
        id: mockDiscordWebhooks[0].id,
        iconUrl: mockDiscordWebhooks[0].avatarUrl,
        name: mockDiscordWebhooks[0].name,
      },
    },
    filters: null,
    id: '2',
    key: FeedConnectionType.DiscordWebhook,
    name: 'Discord Webhook 1',
  }],
  healthStatus: UserFeedHealthStatus.Ok,
  disabledCode: undefined,
  refreshRateSeconds: 60,
}, {
  id: '2',
  title: 'Yahoo News',
  url: 'https://www.feed2.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  healthStatus: UserFeedHealthStatus.Failed,
  connections: [],
  disabledCode: UserFeedDisabledCode.Manual,
  refreshRateSeconds: 60,
}, {
  id: '3',
  title: 'CNN',
  url: 'https://www.feed3.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  healthStatus: UserFeedHealthStatus.Failing,
  connections: [],
  disabledCode: undefined,
  refreshRateSeconds: 60,
}];

export default mockUserFeeds;
