import { ConfigSchema } from "../schemas/ConfigSchema";
import "dotenv/config";

const config = {
  token: process.env.DISCORD_REST_LISTENER_BOT_TOKEN,
  databaseURI: process.env.DISCORD_REST_LISTENER_MONGO_URI,
  maxRequestsPerSecond: Number(
    process.env.DISCORD_REST_LISTENER_MAX_REQ_PER_SEC
  ),
  rabbitmqUri: encodeURI(process.env.DISCORD_REST_LISTENER_RABBITMQ_URI),
  discordClientId: process.env.DISCORD_REST_LISTENER_BOT_CLIENT_ID,
  datadog: {
    apiKey: process.env.DISCORD_REST_LISTENER_DATADOG_API_KEY,
    host: process.env.DISCORD_REST_LISTENER_DATADOG_HOST,
    service: process.env.DISCORD_REST_LISTENER_DATADOG_SERVICE,
  },
};

const parsedConfig = ConfigSchema.parse(config);

export default parsedConfig;
