import { Environment, EnvironmentVariables, validateConfig } from "./validate";

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    FEED_HANDLER_POSTGRES_URI: "postgres://postgres:12345@localhost:5432/test",
    FEED_HANDLER_API_KEY: "123456789",
    FEED_HANDLER_API_PORT: "3000",
    FEED_HANDLER_FEED_REQUESTS_API_URL: "feed-request-service",
    FEED_HANDLER_FEED_REQUESTS_API_KEY: "feed-fetcher-api-key",
    FEED_HANDLER_FEED_MONGODB_URI: "mongodb://localhost:27017",
    FEED_HANDLER_POSTGRES_DATABASE: "test",
    FEED_HANDLER_DISCORD_CLIENT_ID: "discord-client-id",
    FEED_HANDLER_DISCORD_RABBITMQ_URI: "amqp://localhost:5672",
    FEED_HANDLER_RABBITMQ_BROKER_URL: "amqp://localhost:5672",
  };

  validateConfig(vals);

  return vals;
}
