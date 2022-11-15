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
    FEED_FETCHER_API_KEY: process.env.FEED_FETCHER_API_KEY as string,
    FEED_FETCHER_POSTGRES_URI: process.env.FEED_FETCHER_POSTGRES_URI as string,
    FEED_FETCHER_FEEDS_MONGODB_URI: process.env
      .FEED_FETCHER_FEEDS_MONGODB_URI as string,
    FEED_FETCHER_DATADOG_API_KEY: process.env
      .FEED_FETCHER_DATADOG_API_KEY as string,
    FEED_FETCHER_SYNC_DB: process.env.FEED_FETCHER_SYNC_DB === 'true',
    FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_URL: process.env
      .FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_URL as string,
    FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_REGION: process.env
      .FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_REGION as string,
    FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_ENDPOINT: process.env
      .FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_ENDPOINT as string,
    FEED_FETCHER_AWS_ACCESS_KEY_ID: process.env
      .FEED_FETCHER_AWS_ACCESS_KEY_ID as string,
    FEED_FETCHER_AWS_SECRET_ACCESS_KEY: process.env
      .FEED_FETCHER_AWS_SECRET_ACCESS_KEY as string,
    FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS: Number(
      process.env.FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS,
    ),
    FEED_FETCHER_API_PORT: Number(process.env.FEED_FETCHER_API_PORT),
    FEED_FETCHER_SKIP_POLLING_SQS_REQUEST_QUEUE:
      process.env.FEED_FETCHER_SKIP_POLLING_SQS_REQUEST_QUEUE === 'true',
  };

  validateConfig(values);

  return values;
}
