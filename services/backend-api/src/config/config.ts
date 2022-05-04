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

export default function config() {
  return {
    port: parseInt(process.env.PORT as string, 10),
    discordBotToken: process.env.DISCORD_BOT_TOKEN,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    discordRedirectUri: process.env.DISCORD_REDIRECT_URI,
    loginRedirectUri: process.env.LOGIN_REDIRECT_URI,
    mongodbUri: process.env.MONGODB_URI as string,
    defaultRefreshRateMinutes: Number(
      process.env.DEFAULT_REFRESH_RATE_MINUTES as string,
    ),
    defaultMaxFeeds: parseInt(process.env.DEFAULT_MAX_FEEDS as string, 10),
    defaultDateFormat:
      process.env.DEFAULT_DATE_FORMAT || 'ddd, D MMMM YYYY, h:mm A z',
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
    defaultDateLanguage: process.env.DEFAULT_DATE_LANGUAGE || 'en',
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
    datadogApikey: process.env.DATADOG_API_KEY,
    awsScheduleQueueEndpoint: process.env.AWS_SCHEDULE_QUEUE_ENDPOINT,
    awsScheduleQueueRegion: process.env.AWS_SCHEDULE_QUEUE_REGION,
    awsScheduleQueueUrl: process.env.AWS_SCHEDULE_QUEUE_URL,
    awsFailedUrlQueueEndpoint: process.env.AWS_FAILED_URL_QUEUE_ENDPOINT,
    awsFailedUrlQueueRegion: process.env.AWS_FAILED_URL_QUEUE_REGION,
    awsFailedUrlQueueUrl: process.env.AWS_FAILED_URL_QUEUE_URL,
    awsUrlRequestQueueEndpoint: process.env.AWS_URL_REQUEST_QUEUE_ENDPOINT,
    awsUrlRequestQueueRegion: process.env.AWS_URL_REQUEST_QUEUE_REGION,
    awsUrlRequestQueueUrl: process.env.AWS_URL_REQUEST_QUEUE_URL,
    feedFetcherGrpcUrl: process.env.FEED_FETCHER_GRPC_URL,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } as const;
}

export type ConfigKeys = ReturnType<typeof config>;
