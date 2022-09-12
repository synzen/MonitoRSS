import { Environment, EnvironmentVariables, validateConfig } from './validate';

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    POSTGRES_URI: 'postgres://localhost:5432/test',
    FEEDS_MONGODB_URI: 'mongodb://localhost:27017/test',
    AWS_SQS_REQUEST_QUEUE_URL: 'https://sqs-url.com/123456789012/test',
    AWS_SQS_REQUEST_QUEUE_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: '123456789012',
    AWS_SECRET_ACCESS_KEY: '123456789012',
    AWS_SQS_FAILED_URL_QUEUE_ENDPOINT: 'https://sqs-url.com/123456789012/test',
    AWS_SQS_FAILED_URL_QUEUE_URL: 'https://sqs-url.com/123456789012/test',
    AWS_SQS_FAILED_URL_QUEUE_REGION: 'us-east-1',
    FAILED_REQUEST_DURATION_THRESHOLD_HOURS: 36,
  };

  validateConfig(vals);

  return vals;
}
