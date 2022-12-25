import dotenv from 'dotenv';
import path from 'path';
import { Environment, EnvironmentVariables, validateConfig } from './validate';

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

export default function config(): EnvironmentVariables {
  const values: EnvironmentVariables = {
    NODE_ENV: process.env.NODE_ENV as Environment,
    FEED_REQUESTS_API_KEY: process.env.FEED_REQUESTS_API_KEY as string,
    FEED_REQUESTS_POSTGRES_URI: process.env
      .FEED_REQUESTS_POSTGRES_URI as string,
    FEED_REQUESTS_DATADOG_API_KEY: process.env
      .FEED_REQUESTS_DATADOG_API_KEY as string,
    FEED_REQUESTS_SYNC_DB: process.env.FEED_REQUESTS_SYNC_DB === 'true',
    FEED_REQUESTS_FAILED_REQUEST_DURATION_THRESHOLD_HOURS: Number(
      process.env.FEED_REQUESTS_FAILED_REQUEST_DURATION_THRESHOLD_HOURS,
    ),
    FEED_REQUESTS_API_PORT: Number(process.env.FEED_REQUESTS_API_PORT),
    FEED_REQUESTS_RABBITMQ_BROKER_URL: process.env
      .FEED_REQUESTS_RABBITMQ_BROKER_URL as string,
  };

  validateConfig(values);

  return values;
}
