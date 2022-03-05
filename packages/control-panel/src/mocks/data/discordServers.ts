import { DiscordServer } from '../../features/discordServers/types/DiscordServer';

const mockDiscordServers: DiscordServer[] = [{
  id: '1',
  name: 'Server 1',
  iconUrl: 'https://via.placeholder.com/140x100',
  benefits: {
    maxFeeds: 10,
    webhooks: false,
  },
}, {
  id: '2',
  name: 'Server 2',
  iconUrl: 'https://via.placeholder.com/140x100',
  benefits: {
    maxFeeds: 50,
    webhooks: false,
  },
}, {
  id: '3',
  name: 'Server 3',
  iconUrl: 'https://via.placeholder.com/140x100',
  benefits: {
    maxFeeds: 100,
    webhooks: true,
  },
}];

export default mockDiscordServers;
