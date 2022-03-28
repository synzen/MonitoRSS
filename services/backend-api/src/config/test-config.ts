import config from './config';

export default (): ReturnType<typeof config> => ({
  ...config(),
  discordBotToken: 'bot-token',
  discordClientId: 'discord-client-id',
  discordClientSecret: 'discord-client-secret',
  discordRedirectUri: 'discord-redirect-uri',
  defaultRefreshRateMinutes: 10,
  defaultMaxFeeds: 5,
  vipRefreshRateMinutes: 2,
  vipEnabled: false,
  apiSubscriptionsEnabled: false,
  sessionSecret: 'secret',
  sessionSalt: 'salt',
  feedUserAgent: 'feed-user-agent',
});
