import { Environment, EnvironmentVariables, validateConfig } from './validate';

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    FEED_FETCHER_POSTGRES_URI: 'postgres://localhost:5432/test',
    FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_URL:
      'https://sqs-url.com/123456789012/test',
    FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_REGION: 'us-east-1',
    FEED_FETCHER_AWS_ACCESS_KEY_ID: '123456789012',
    FEED_FETCHER_AWS_SECRET_ACCESS_KEY: '123456789012',
    FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS: 36,
    FEED_FETCHER_API_KEY: '123456789',
    FEED_FETCHER_FEEDS_MONGODB_URI: 'mongodb://localhost:27017/test',
    FEED_FETCHER_API_PORT: 3000,
  };

  validateConfig(vals);

  return vals;
}
