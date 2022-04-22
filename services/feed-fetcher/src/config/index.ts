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
    POSTGRES_URI: process.env.POSTGRES_URI as string,
    DATADOG_API_KEY: process.env.DATADOG_API_KEY as string,
    SYNC_DB: process.env.SYNC_DB === 'true',
    AWS_SQS_QUEUE_URL: process.env.AWS_SQS_QUEUE_URL as string,
    AWS_REGION: process.env.AWS_REGION as string,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID as string,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY as string,
    AWS_SQS_QUEUE_SERVICE_ENDPOINT: process.env
      .AWS_SQS_QUEUE_SERVICE_ENDPOINT as string,
    AWS_SQS_FAILED_URL_QUEUE_ENDPOINT: process.env
      .AWS_SQS_FAILED_URL_QUEUE_ENDPOINT as string,
    AWS_SQS_FAILED_URL_QUEUE_URL: process.env
      .AWS_SQS_FAILED_URL_QUEUE_URL as string,
    AWS_SQS_FAILED_URL_QUEUE_REGION: process.env
      .AWS_SQS_FAILED_URL_QUEUE_REGION as string,
    FAILED_REQUEST_DURATION_THRESHOLD_HOURS: Number(
      process.env.FAILED_REQUEST_DURATION_THRESHOLD_HOURS,
    ),
  } as const);
