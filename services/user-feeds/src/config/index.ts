import dotenv from "dotenv";
import path from "path";
import { testConfig } from "./test.config";
import { Environment, EnvironmentVariables, validateConfig } from "./validate";

const envFiles: Record<string, string> = {
  development: ".env.development",
  production: ".env.production",
  local: ".env.local",
  test: ".env.test",
};

const envFilePath = path.join(
  __dirname,
  "..",
  "..",
  envFiles[process.env.NODE_ENV as string] || envFiles.local
);

dotenv.config({
  path: envFilePath,
});

export function config(options?: {
  skipValidation?: boolean;
}): EnvironmentVariables {
  if (process.env.NODE_ENV === "test") {
    return testConfig();
  }

  const configVals = {
    NODE_ENV: (process.env.NODE_ENV as Environment) || Environment.Local,
    USER_FEEDS_DATADOG_API_KEY: process.env
      .USER_FEEDS_DATADOG_API_KEY as string,
    USER_FEEDS_FEED_REQUESTS_API_URL: process.env
      .USER_FEEDS_FEED_REQUESTS_API_URL as string,
    USER_FEEDS_FEED_REQUESTS_GRPC_URL: process.env
      .USER_FEEDS_FEED_REQUESTS_GRPC_URL as string,
    USER_FEEDS_FEED_REQUESTS_GRPC_USE_TLS: process.env
      .USER_FEEDS_FEED_REQUESTS_GRPC_USE_TLS as string,
    USER_FEEDS_FEED_REQUESTS_API_KEY: process.env
      .USER_FEEDS_FEED_REQUESTS_API_KEY as string,
    USER_FEEDS_POSTGRES_URI: process.env.USER_FEEDS_POSTGRES_URI as string,
    USER_FEEDS_POSTGRES_DATABASE: process.env
      .USER_FEEDS_POSTGRES_DATABASE as string,
    USER_FEEDS_DISCORD_CLIENT_ID: process.env
      .USER_FEEDS_DISCORD_CLIENT_ID as string,
    USER_FEEDS_DISCORD_API_TOKEN: process.env
      .USER_FEEDS_DISCORD_API_TOKEN as string,
    USER_FEEDS_DISCORD_RABBITMQ_URI: process.env
      .USER_FEEDS_DISCORD_RABBITMQ_URI as string,
    USER_FEEDS_API_PORT: process.env.USER_FEEDS_API_PORT as string,
    USER_FEEDS_API_KEY: process.env.USER_FEEDS_API_KEY as string,
    USER_FEEDS_RABBITMQ_BROKER_URL: encodeURI(
      process.env.USER_FEEDS_RABBITMQ_BROKER_URL as string
    ),
    USER_FEEDS_POSTGRES_REPLICA1_URI: process.env
      .USER_FEEDS_POSTGRES_REPLICA1_URI as string,
    USER_FEEDS_REDIS_DISABLE_CLUSTER:
      process.env.USER_FEEDS_REDIS_DISABLE_CLUSTER === "true",
    USER_FEEDS_REDIS_URI: process.env.USER_FEEDS_REDIS_URI as string,
    USER_FEEDS_USE_PARTITIONED_TABLES:
      process.env.USER_FEEDS_USE_PARTITIONED_TABLES === "true",
    USER_FEEDS_PREFETCH_COUNT: parseInt(
      (process.env.USER_FEEDS_PREFETCH_COUNT as string) || "100",
      10
    ),
  } as const;

  if (!options?.skipValidation) {
    validateConfig(configVals);
  }

  return configVals;
}

export type ConfigKeys = ReturnType<typeof config>;
