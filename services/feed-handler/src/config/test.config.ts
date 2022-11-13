import { Environment, EnvironmentVariables, validateConfig } from "./validate";

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    POSTGRES_URI: "postgres://postgres:12345@localhost:5432/test",
    AWS_ACCESS_KEY_ID: "123456789012",
    AWS_SECRET_ACCESS_KEY: "123456789012",
    AWS_REGION: "us-east-1",
    API_KEY: "123456789",
    PORT: "3000",
    FEED_REQUEST_SERVICE_URL: "feed-request-service",
    FEED_MONGODB_URI: "mongodb://localhost:27017",
    POSTGRES_DATABASE: "test",
    DISCORD_CLIENT_ID: "discord-client-id",
    DISCORD_RABBITMQ_URI: "amqp://localhost:5672",
    FEED_EVENT_QUEUE_URL: "feed-event-queue",
  };

  validateConfig(vals);

  return vals;
}
