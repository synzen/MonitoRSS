import { UserFeed } from '@/features/feed';

const mockUserFeeds: UserFeed[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'ok',
}, {
  id: '2',
  title: 'Yahoo News',
  url: 'https://www.feed2.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'failed',
}, {
  id: '3',
  title: 'CNN',
  url: 'https://www.feed3.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'failing',
}];

export default mockUserFeeds;
