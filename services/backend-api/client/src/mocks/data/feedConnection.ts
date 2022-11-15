import { FeedConnection, FeedConnectionType } from '@/types';
import mockDiscordChannels from './discordChannels';
import mockDiscordServers from './discordServers';

export const mockFeedChannelConnections: FeedConnection[] = [{
  id: '1',
  filters: null,
  name: 'discord-channel-connection-1',
  details: {
    embeds: [],
    channel: {
      id: mockDiscordChannels[0].id,
      guildId: mockDiscordServers[0].id,
    },
    content: 'test',
  },
  key: FeedConnectionType.DiscordChannel,
}];

export const mockFeedWebhookConnections: FeedConnection[] = [{
  id: '2',
  filters: null,
  name: 'discord-webhook-connection-1',
  details: {
    webhook: {
      id: '1',
      name: 'test',
      guildId: mockDiscordServers[0].id,
    },
    content: 'test',
    embeds: [],
  },
  key: FeedConnectionType.DiscordWebhook,
}];
