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
    FEED_HANDLER_FEED_REQUESTS_API_URL: process.env
      .FEED_HANDLER_FEED_REQUESTS_API_URL as string,
    FEED_HANDLER_FEED_REQUESTS_API_KEY: process.env
      .FEED_HANDLER_FEED_REQUESTS_API_KEY as string,
    FEED_HANDLER_POSTGRES_URI: process.env.FEED_HANDLER_POSTGRES_URI as string,
    FEED_HANDLER_FEED_MONGODB_URI: process.env
      .FEED_HANDLER_FEED_MONGODB_URI as string,
    FEED_HANDLER_POSTGRES_DATABASE: process.env
      .FEED_HANDLER_POSTGRES_DATABASE as string,
    FEED_HANDLER_DISCORD_CLIENT_ID: process.env
      .FEED_HANDLER_DISCORD_CLIENT_ID as string,
    FEED_HANDLER_DISCORD_RABBITMQ_URI: process.env
      .FEED_HANDLER_DISCORD_RABBITMQ_URI as string,
    FEED_HANDLER_API_PORT: process.env.FEED_HANDLER_API_PORT as string,
    FEED_HANDLER_API_KEY: process.env.FEED_HANDLER_API_KEY as string,
    FEED_HANDLER_RABBITMQ_BROKER_URL: process.env
      .FEED_HANDLER_RABBITMQ_BROKER_URL as string,
  } as const;

  if (!options?.skipValidation) {
    validateConfig(configVals);
  }

  return configVals;
}

export type ConfigKeys = ReturnType<typeof config>;
