import dotenv from "dotenv";
import path from "path";
import {
  Environment,
  EnvironmentVariables,
  validateConfig,
} from "./config.validate";

const envFiles: Record<string, string> = {
  development: ".env.development",
  production: ".env.production",
  local: ".env.local",
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

export default function config(options?: {
  skipValidation?: boolean;
}): EnvironmentVariables {
  const port = parseInt(process.env.BACKEND_API_PORT as string, 10);

  const configVals: EnvironmentVariables = {
    NODE_ENV: (process.env.NODE_ENV as Environment) || Environment.Local,
    BACKEND_API_PORT: isNaN(port) ? 3000 : port,
    BACKEND_API_DISCORD_BOT_TOKEN: process.env
      .BACKEND_API_DISCORD_BOT_TOKEN as string,
    BACKEND_API_DISCORD_CLIENT_ID: process.env
      .BACKEND_API_DISCORD_CLIENT_ID as string,
    BACKEND_API_DISCORD_CLIENT_SECRET: process.env
      .BACKEND_API_DISCORD_CLIENT_SECRET as string,
    BACKEND_API_DISCORD_REDIRECT_URI: process.env
      .BACKEND_API_DISCORD_REDIRECT_URI as string,
    BACKEND_API_LOGIN_REDIRECT_URI: process.env
      .BACKEND_API_LOGIN_REDIRECT_URI as string,
    BACKEND_API_MONGODB_URI: process.env.BACKEND_API_MONGODB_URI as string,
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: Number(
      process.env.BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES as string
    ),
    BACKEND_API_DEFAULT_MAX_FEEDS: parseInt(
      process.env.BACKEND_API_DEFAULT_MAX_FEEDS as string,
      10
    ),
    BACKEND_API_DEFAULT_DATE_FORMAT:
      process.env.BACKEND_API_DEFAULT_DATE_FORMAT ||
      "ddd, D MMMM YYYY, h:mm A z",
    BACKEND_API_DEFAULT_TIMEZONE:
      process.env.BACKEND_API_DEFAULT_TIMEZONE || "UTC",
    BACKEND_API_DEFAULT_DATE_LANGUAGE:
      process.env.BACKEND_API_DEFAULT_DATE_LANGUAGE || "en",
    BACKEND_API_SUBSCRIPTIONS_ENABLED:
      process.env.BACKEND_API_SUBSCRIPTIONS_ENABLED === "true",
    BACKEND_API_SUBSCRIPTIONS_HOST:
      process.env.BACKEND_API_SUBSCRIPTIONS_HOST || "",
    BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN:
      process.env.BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN || "",
    BACKEND_API_SESSION_SECRET: process.env
      .BACKEND_API_SESSION_SECRET as string,
    BACKEND_API_SESSION_SALT: process.env.BACKEND_API_SESSION_SALT as string,
    BACKEND_API_FEED_USER_AGENT: process.env
      .BACKEND_API_FEED_USER_AGENT as string,
    BACKEND_API_DATADOG_API_KEY: process.env.BACKEND_API_DATADOG_API_KEY,
    BACKEND_API_FEED_REQUESTS_API_HOST: process.env
      .BACKEND_API_FEED_REQUESTS_API_HOST as string,
    BACKEND_API_FEED_REQUESTS_API_KEY: process.env
      .BACKEND_API_FEED_REQUESTS_API_KEY as string,
    BACKEND_API_USER_FEEDS_API_HOST: process.env
      .BACKEND_API_USER_FEEDS_API_HOST as string,
    BACKEND_API_USER_FEEDS_API_KEY: process.env
      .BACKEND_API_USER_FEEDS_API_KEY as string,
    BACKEND_API_RABBITMQ_BROKER_URL: process.env
      .BACKEND_API_RABBITMQ_BROKER_URL as string,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: Number(
      (process.env.BACKEND_API_DEFAULT_MAX_USER_FEEDS as string) || 0
    ),
    BACKEND_API_ENABLE_SUPPORTERS:
      process.env.BACKEND_API_ENABLE_SUPPORTERS === "true",
    BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: Number(
      (process.env.BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS as string) || 5
    ),
    BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: Number(
      (process.env.BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER as string) || 100
    ),
    BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: Number(
      (process.env.BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT as string) || 0
    ),
    BACKEND_API_SMTP_HOST: process.env.BACKEND_API_SMTP_HOST as string,
    BACKEND_API_SMTP_USERNAME: process.env.BACKEND_API_SMTP_USERNAME as string,
    BACKEND_API_SMTP_PASSWORD: process.env.BACKEND_API_SMTP_PASSWORD as string,
    BACKEND_API_SMTP_FROM: process.env.BACKEND_API_SMTP_FROM as string,
    BACKEND_API_PADDLE_KEY: process.env.BACKEND_API_PADDLE_KEY as string,
    BACKEND_API_PADDLE_URL: process.env.BACKEND_API_PADDLE_URL as string,
    BACKEND_API_PADDLE_WEBHOOK_SECRET: process.env
      .BACKEND_API_PADDLE_WEBHOOK_SECRET as string,
    BACKEND_API_ALLOW_LEGACY_REVERSION:
      process.env.BACKEND_API_ALLOW_LEGACY_REVERSION === "true" || false,
    BACKEND_API_SUPPORTER_GUILD_ID: process.env.BACKEND_API_SUPPORTER_GUILD_ID,
    BACKEND_API_SUPPORTER_ROLE_ID: process.env.BACKEND_API_SUPPORTER_ROLE_ID,
    BACKEND_API_SUPPORTER_SUBROLE_IDS:
      process.env.BACKEND_API_SUPPORTER_SUBROLE_IDS,
    BACKEND_API_SENTRY_HOST: process.env.BACKEND_API_SENTRY_HOST,
    BACKEND_API_SENTRY_PROJECT_IDS:
      process.env.BACKEND_API_SENTRY_PROJECT_IDS?.split(",") || [],
  };

  if (!options?.skipValidation) {
    validateConfig(configVals);
  }

  return configVals;
}

export type ConfigKeys = ReturnType<typeof config>;
