import { Feed } from '../../features/feed';
import mockDiscordWebhooks from './discordWebhooks';

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
  checkTitles: false,
  checkDates: false,
  directSubscribers: true,
  disabled: '',
  formatTables: false,
  imgLinksExistence: false,
  imgPreviews: false,
  failReason: undefined,
  ncomparisons: [],
  pcomparisons: [],
  webhook: {
    id: mockDiscordWebhooks[0].id,
  },
  filters: [{
    category: 'title',
    value: 'New York Times',
  }, {
    category: 'url',
    value: 'https://www.feed1.com',
  }, {
    category: 'title',
    value: 'Yahoo News',
  }],
}];

export default mockFeeds;
