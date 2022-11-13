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
    API_KEY: process.env.API_KEY as string,
    POSTGRES_URI: process.env.POSTGRES_URI as string,
    FEEDS_MONGODB_URI: process.env.FEEDS_MONGODB_URI as string,
    DATADOG_API_KEY: process.env.DATADOG_API_KEY as string,
    SYNC_DB: process.env.SYNC_DB === 'true',
    AWS_SQS_REQUEST_QUEUE_URL: process.env.AWS_SQS_REQUEST_QUEUE_URL as string,
    AWS_SQS_REQUEST_QUEUE_REGION: process.env
      .AWS_SQS_REQUEST_QUEUE_REGION as string,
    AWS_SQS_REQUEST_QUEUE_ENDPOINT: process.env
      .AWS_SQS_REQUEST_QUEUE_ENDPOINT as string,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID as string,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY as string,
    FAILED_REQUEST_DURATION_THRESHOLD_HOURS: Number(
      process.env.FAILED_REQUEST_DURATION_THRESHOLD_HOURS,
    ),
    API_PORT: Number(process.env.API_PORT),
    SKIP_POLLING_SQS_REQUEST_QUEUE:
      process.env.SKIP_POLLING_SQS_REQUEST_QUEUE === 'true',
  };

  validateConfig(values);

  return values;
}
