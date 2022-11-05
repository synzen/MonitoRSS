import config from "./config";
import { validateConfig } from "./config.validate";

export default (): ReturnType<typeof config> => {
  const configVals = {
    ...config({
      skipValidation: true,
    }),
    DISCORD_BOT_TOKEN: "bot-token",
    DISCORD_CLIENT_ID: "discord-client-id",
    DISCORD_CLIENT_SECRET: "discord-client-secret",
    DISCORD_REDIRECT_URI: "discord-redirect-uri",
    DEFAULT_REFRESH_RATE_MINUTES: 10,
    DEFAULT_MAX_FEEDS: 5,
    VIP_REFRESH_RATE_MINUTES: 2,
    VIP_ENABLED: false,
    API_SUBSCRIPTIONS_ENABLED: false,
    SESSION_SECRET: "secret",
    SESSION_SALT: "salt",
    FEED_USER_AGENT: "feed-user-agent",
    FEED_FETCHER_API_HOST: "http://feed-fetcher-api-host.com:3000",
  };

  validateConfig(configVals);

  return configVals;
};
