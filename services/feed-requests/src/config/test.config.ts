import { Environment, EnvironmentVariables, validateConfig } from './validate';

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    FEED_REQUESTS_POSTGRES_URI: 'postgres://postgres:12345@localhost:5432/test',
    FEED_REQUESTS_API_KEY: '123456789',
    FEED_REQUESTS_API_PORT: 3000,
    FEED_REQUESTS_RABBITMQ_BROKER_URL: 'amqp://localhost:5672',
    FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT: 'test',
    FEED_REQUESTS_REDIS_URI: 'redis://localhost:6379',
    FEED_REQUESTS_MAX_FAIL_ATTEMPTS: 11,
    FEED_REQUESTS_REQUEST_TIMEOUT_MS: 15000,
    FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT: 3,
  };

  validateConfig(vals);

  return vals;
}
