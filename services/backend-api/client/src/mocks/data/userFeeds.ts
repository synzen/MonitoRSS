import { UserFeed } from '@/features/feed';
import { UserFeedDisabledCode, UserFeedHealthStatus } from '../../features/feed/types';

const mockUserFeeds: UserFeed[] = [{
  id: '1',
  title: 'New York Times',
  url: 'https://www.feed1.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  connections: [],
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
