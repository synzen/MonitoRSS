import dotenv from 'dotenv';
import path from 'path';
import { validateConfig } from './config.validate';

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

export default function config(options?: { skipValidation?: boolean }) {
  const configVals = {
    NODE_ENV: process.env.NODE_ENV,
    port: parseInt(process.env.PORT as string, 10),
    PORT: parseInt(process.env.PORT as string, 10),
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
    LOGIN_REDIRECT_URI: process.env.LOGIN_REDIRECT_URI,
    MONGODB_URI: process.env.MONGODB_URI as string,
    DEFAULT_REFRESH_RATE_MINUTES: Number(
      process.env.DEFAULT_REFRESH_RATE_MINUTES as string,
    ),
    DEFAULT_MAX_FEEDS: parseInt(process.env.DEFAULT_MAX_FEEDS as string, 10),
    DEFAULT_DATE_FORMAT:
      process.env.DEFAULT_DATE_FORMAT || 'ddd, D MMMM YYYY, h:mm A z',
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'UTC',
    DEFAULT_DATE_LANGUAGE: process.env.DEFAULT_DATE_LANGUAGE || 'en',
    API_SUBSCRIPTIONS_ENABLED: process.env.API_SUBSCRIPTIONS_ENABLED === 'true',
    API_SUBSCRIPTIONS_HOST: process.env.API_SUBSCRIPTIONS_HOST || '',
    API_SUBSCRIPTIONS_ACCESS_TOKEN:
      process.env.API_SUBSCRIPTIONS_ACCESS_TOKEN || '',
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_SALT: process.env.SESSION_SALT,
    FEED_USER_AGENT: process.env.FEED_USER_AGENT,
    DATADOG_API_KEY: process.env.DATADOG_API_KEY,
    AWS_FAILED_URL_QUEUE_ENDPOINT: process.env.AWS_FAILED_URL_QUEUE_ENDPOINT,
    AWS_FAILED_URL_QUEUE_REGION: process.env.AWS_FAILED_URL_QUEUE_REGION,
    AWS_FAILED_URL_QUEUE_URL: process.env.AWS_FAILED_URL_QUEUE_URL,
    AWS_URL_REQUEST_QUEUE_ENDPOINT: process.env.AWS_URL_REQUEST_QUEUE_ENDPOINT,
    AWS_URL_REQUEST_QUEUE_REGION: process.env.AWS_URL_REQUEST_QUEUE_REGION,
    AWS_URL_REQUEST_QUEUE_URL: process.env.AWS_URL_REQUEST_QUEUE_URL,
    FEED_FETCHER_GRPC_URL: process.env.FEED_FETCHER_GRPC_URL,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  } as const;

  if (!options?.skipValidation) {
    validateConfig(configVals);
  }

  return configVals;
}

export type ConfigKeys = ReturnType<typeof config>;
