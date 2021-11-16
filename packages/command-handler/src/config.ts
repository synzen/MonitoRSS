import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  botToken: z.string().min(1).default(process.env.BOT_TOKEN as string),
  botClientId: z.string().min(1).default(process.env.BOT_CLIENT_ID as string),
  testingGuildId: z.string().min(1).default(process.env.TESTING_GUILD_ID as string),
  mongoUri: z.string().min(1).default(process.env.MONGO_URI as string),
  defaultRefreshRateMinutes: z.number().default(
    Number(process.env.DEFAULT_REFRESH_RATE_MINUTES as string),
  ),
  defaultMaxFeeds: z.number().default(
    Number(process.env.DEFAULT_MAX_FEEDS as string),
  ),
  apis: z.object({
    subscriptions: z.object({
      enabled: z.boolean().default(
        process.env.API_SUBSCRIPTIONS_ENABLED === 'true',
      ),
      host: z.string().min(1).default(process.env.API_SUBSCRIPTIONS_HOST as string),
      accessToken: z.string().min(1).default(
        process.env.API_SUBSCRIPTIONS_ACCESS_TOKEN as string,
      ),
    })
      .partial()  
      .refine(data => {
        return (data.enabled && data.host && data.accessToken) || !data.enabled;
      }
      , 'Host and access token for subscription API must be set when enabled'),
  }).default({
    subscriptions: {
      enabled: false,
    },
  }),
});

const config = configSchema.parse({});

export default config;
