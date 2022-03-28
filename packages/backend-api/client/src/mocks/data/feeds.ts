import { FeedSummary } from '@/features/feed';
import mockDiscordChannels from './discordChannels';

const mockFeedSummaries: FeedSummary[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  channel: mockDiscordChannels[0].id,
  status: 'ok',
  createdAt: new Date().toISOString(),
  failReason: undefined,
  disabledReason: undefined,
}, {
  id: '2',
  title: 'Yahoo News',
  url: 'https://www.feed2.com',
  channel: mockDiscordChannels[1].id,
  status: 'ok',
  createdAt: new Date().toISOString(),
  failReason: undefined,
  disabledReason: undefined,
}, {
  id: '3',
  title: 'CNN',
  url: 'https://www.feed3.com',
  channel: mockDiscordChannels[2].id,
  status: 'disabled',
  failReason: undefined,
  disabledReason: 'Disabled reason',
  createdAt: new Date().toISOString(),
}];

export default mockFeedSummaries;
