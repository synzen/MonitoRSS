import dotenv from 'dotenv';
import path from 'path';
import { testConfig } from './test.config';
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
  if (process.env.NODE_ENV === 'test') {
    return testConfig();
  }

  const values: EnvironmentVariables = {
    NODE_ENV: process.env.NODE_ENV as Environment,
    FEED_REQUESTS_API_KEY: process.env.FEED_REQUESTS_API_KEY as string,
    FEED_REQUESTS_POSTGRES_URI: process.env
      .FEED_REQUESTS_POSTGRES_URI as string,
    FEED_REQUESTS_DATADOG_API_KEY: process.env
      .FEED_REQUESTS_DATADOG_API_KEY as string,
    FEED_REQUESTS_SYNC_DB: process.env.FEED_REQUESTS_SYNC_DB === 'true',
    FEED_REQUESTS_MAX_FAIL_ATTEMPTS: Number(
      process.env.FEED_REQUESTS_MAX_FAIL_ATTEMPTS || 11,
    ),
    FEED_REQUESTS_API_PORT: Number(process.env.FEED_REQUESTS_API_PORT),
    FEED_REQUESTS_RABBITMQ_BROKER_URL: process.env
      .FEED_REQUESTS_RABBITMQ_BROKER_URL as string,
    FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT: process.env
      .FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT as string,
    FEED_REQUESTS_S3_ENDPOINT: process.env.FEED_REQUESTS_S3_ENDPOINT,
    FEED_REQUESTS_S3_API_KEY_ID: process.env.FEED_REQUESTS_S3_API_KEY_ID,
    FEED_REQUESTS_S3_API_KEY: process.env.FEED_REQUESTS_S3_API_KEY,
    FEED_REQUESTS_REDIS_URI: process.env.FEED_REQUESTS_REDIS_URI as string,
    FEED_REQUESTS_REDIS_DISABLE_CLUSTER:
      process.env.FEED_REQUESTS_REDIS_DISABLE_CLUSTER === 'true',
    FEED_REQUESTS_POSTGRES_REPLICA1_URI: process.env
      .FEED_REQUESTS_POSTGRES_REPLICA1_URI as string,
    FEED_REQUESTS_REQUEST_TIMEOUT_MS: Number(
      process.env.FEED_REQUESTS_REQUEST_TIMEOUT_MS || '15000',
    ),
  };

  validateConfig(values);

  return values;
}
