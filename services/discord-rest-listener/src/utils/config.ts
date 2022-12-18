import { ConfigSchema } from '../schemas/ConfigSchema'
import 'dotenv/config'

const config = {
  token: process.env.TOKEN,
  databaseURI: process.env.DATABASE_URI,
  maxRequestsPerSecond: Number(process.env.MAX_REQUESTS_PER_SECOND),
  rabbitmqUri: process.env.RABBITMQ_URI,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  datadog: {
    apiKey: process.env.DATADOG_API_KEY,
    host: process.env.DATADOG_HOST,
    service: process.env.DATADOG_SERVICE,
  },
}

const parsedConfig = ConfigSchema.parse(config)

export default parsedConfig
