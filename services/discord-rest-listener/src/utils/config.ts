import { ConfigSchema } from "../schemas/ConfigSchema";
import "dotenv/config";

const config = {
  token: process.env.DISCORD_REST_LISTENER_BOT_TOKEN,
  databaseURI: process.env.DISCORD_REST_LISTENER_MONGO_URI,
  maxRequestsPerSecond: Number(
    process.env.DISCORD_REST_LISTENER_MAX_REQ_PER_SEC
  ),
  rabbitmqUri: encodeURI(
    (process.env.DISCORD_REST_LISTENER_RABBITMQ_URI as string) || ""
  ),
  discordClientId: process.env.DISCORD_REST_LISTENER_BOT_CLIENT_ID,
  exitOnGlobalBlock:
    process.env.DISCORD_REST_LISTENER_EXIT_ON_GLOBAL_BLOCK === "true",
  datadog: {
    apiKey: process.env.DISCORD_REST_LISTENER_DATADOG_API_KEY,
    host: process.env.DISCORD_REST_LISTENER_DATADOG_HOST,
    service: process.env.DISCORD_REST_LISTENER_DATADOG_SERVICE,
  },
  otlp: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    service: process.env.OTEL_SERVICE_NAME || process.env.DISCORD_REST_LISTENER_DATADOG_SERVICE,
  },
};

const parsedConfig = ConfigSchema.parse(config);

export default parsedConfig;
