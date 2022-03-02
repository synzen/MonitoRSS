import { FeedSummary } from '@/features/feed';

const mockFeedSummaries: FeedSummary[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  channel: '#general',
  status: 'ok',
  createdAt: new Date().toISOString(),
}, {
  id: '2',
  title: 'Yahoo News',
  url: 'https://www.feed2.com',
  channel: '#general',
  status: 'ok',
  createdAt: new Date().toISOString(),
}, {
  id: '3',
  title: 'CNN',
  url: 'https://www.feed3.com',
  channel: '#general',
  status: 'ok',
  createdAt: new Date().toISOString(),
}];

export default mockFeedSummaries;
