import dotenv from 'dotenv';
import path from 'path';

const envFiles: Record<string, string> = {
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
};

const envFilePath = path.join(
  __dirname,
  '..',
  '..',
  envFiles[process.env.NODE_ENV as string] || envFiles.local,
);

dotenv.config({
  path: envFilePath,
});

export default () =>
  ({
    port: parseInt(process.env.PORT as string, 10),
    discordBotToken: process.env.DISCORD_BOT_TOKEN,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    discordRedirectUri: process.env.DISCORD_REDIRECT_URI,
    mongodbUri: process.env.MONGODB_URI as string,
    defaultRefreshRateMinutes: parseInt(
      process.env.DEFAULT_REFRESH_RATE_MINUTES as string,
      10,
    ),
    defaultMaxFeeds: parseInt(process.env.DEFAULT_MAX_FEEDS as string, 10),
    vipRefreshRateMinutes: parseInt(
      (process.env.VIP_REFRESH_RATE_MINUTES as string) || '2',
      10,
    ),
    vipEnabled: process.env.VIP_ENABLED === 'true',
    apiSubscriptionsEnabled: process.env.API_SUBSCRIPTIONS_ENABLED === 'true',
    apiSubscriptionsHost: process.env.API_SUBSCRIPTIONS_HOST || '',
    apiSubscriptionsAccessToken:
      process.env.API_SUBSCRIPTIONS_ACCESS_TOKEN || '',
    sessionSecret: process.env.SESSION_SECRET,
    sessionSalt: process.env.SESSION_SALT,
    feedUserAgent: process.env.FEED_USER_AGENT,
  } as const);
