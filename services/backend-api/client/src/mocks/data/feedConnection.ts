import { FeedConnection } from '../../features/feed';
import { FeedConnectionType } from '../../features/feed/constants';
import mockDiscordChannels from './discordChannels';

const mockFeedConnections: FeedConnection[] = [{
  id: '1',
  details: {
    embeds: [],
    channel: {
      id: mockDiscordChannels[0].id,
    },
    content: 'test',
  },
  key: FeedConnectionType.DiscordChannel,
}];

export default mockFeedConnections;
