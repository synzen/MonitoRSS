import { FeedConnectionType } from '@/features/feed/constants';
import { FeedConnection } from '@/features/feedConnections';
import mockDiscordChannels from './discordChannels';

export const mockFeedChannelConnections: FeedConnection[] = [{
  id: '1',
  filters: null,
  details: {
    embeds: [],
    channel: {
      id: mockDiscordChannels[0].id,
    },
    content: 'test',
  },
  key: FeedConnectionType.DiscordChannel,
}];

export const mockFeedWebhookConnections: FeedConnection[] = [{
  id: '1',
  filters: null,
  details: {
    webhook: {
      id: '1',
      name: 'test',
    },
    content: 'test',
    embeds: [],
  },
  key: FeedConnectionType.DiscordWebhook,
}];
