import { Environment, EnvironmentVariables, validateConfig } from "./validate";

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    FEED_HANDLER_POSTGRES_URI: "postgres://postgres:12345@localhost:5432/test",
    FEED_HANDLER_AWS_ACCESS_KEY_ID: "123456789012",
    FEED_HANDLER_AWS_SECRET_ACCESS_KEY: "123456789012",
    FEED_HANDLER_AWS_REGION: "us-east-1",
    FEED_HANDLER_API_KEY: "123456789",
    FEED_HANDLER_API_PORT: "3000",
    FEED_HANDLER_FEED_REQUEST_SERVICE_URL: "feed-request-service",
    FEED_HANDLER_FEED_MONGODB_URI: "mongodb://localhost:27017",
    FEED_HANDLER_POSTGRES_DATABASE: "test",
    FEED_HANDLER_DISCORD_CLIENT_ID: "discord-client-id",
    FEED_HANDLER_DISCORD_RABBITMQ_URI: "amqp://localhost:5672",
    FEED_HANDLER_FEED_EVENT_QUEUE_URL: "feed-event-queue",
  };

  validateConfig(vals);

  return vals;
}
