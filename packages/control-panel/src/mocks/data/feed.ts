import { Feed } from '../../features/feed';

const mockFeeds: Feed[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  channel: '#general',
  status: 'ok',
  embeds: [],
  text: 'Feed Text Here',
  createdAt: new Date().toISOString(),
  refreshRateSeconds: 60,
}];

export default mockFeeds;
