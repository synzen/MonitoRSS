import { DiscordUser } from '@/features/discordUser';

const mockDiscordUser: DiscordUser = {
  id: '1',
  username: 'My name'.padEnd(1000, 'nasd'),
  iconUrl: undefined,
  maxFeeds: 10,
  supporter: {
    expireAt: new Date().toISOString(),
    guilds: [],
    maxFeeds: 10,
    maxGuilds: 10,
  },
};

export default mockDiscordUser;
