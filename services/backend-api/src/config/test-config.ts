import config from "./config";
import { EnvironmentVariables, validateConfig } from "./config.validate";

export default (): ReturnType<typeof config> => {
  const configVals: EnvironmentVariables = {
    ...config({
      skipValidation: true,
    }),
    BACKEND_API_DISCORD_BOT_TOKEN: "bot-token",
    BACKEND_API_DISCORD_CLIENT_ID: "discord-client-id",
    BACKEND_API_DISCORD_CLIENT_SECRET: "discord-client-secret",
    BACKEND_API_DISCORD_REDIRECT_URI: "discord-redirect-uri",
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 10,
    BACKEND_API_DEFAULT_MAX_FEEDS: 5,
    BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
    BACKEND_API_SESSION_SECRET: "secret",
    BACKEND_API_SESSION_SALT: "salt",
    BACKEND_API_FEED_USER_AGENT: "feed-user-agent",
    BACKEND_API_FEED_FETCHER_API_HOST: "http://feed-fetcher-api-host.com:3000",
    BACKEND_API_FEED_FETCHER_API_KEY: "feed-fetcher-api-key",
    BACKEND_API_FEED_HANDLER_API_HOST: "http://feed-handler-api-host.com:3000",
    BACKEND_API_FEED_HANDLER_API_KEY: "feed-handler-api-key",
    BACKEND_API_RABBITMQ_BROKER_URL: "amqp://rabbitmq-broker-url.com:5672",
  };

  validateConfig(configVals);

  return configVals;
};
