import { z } from 'zod';

const configSchema = z.object({
  mongoUri: z.string().min(1),
  defaultRefreshRateMinutes: z.number(),
  defaultMaxFeeds: z.number(),
  vipRefreshRateMinutes: z.number().default(2),
  vipRestrictedCommands: z.boolean().default(false),
  vipEnabled: z.boolean().default(false),
  apis: z.object({
    subscriptions: z.object({
      enabled: z.boolean(),
      host: z.string().min(1),
      accessToken: z.string().min(1),
    })
      .partial()
      .refine(data => {
        return (data.enabled && data.host && data.accessToken) || !data.enabled;
      }, 'Host and access token for subscription API must be set when enabled'),
  }),
});

export type Config = z.output<typeof configSchema>;

export default configSchema;
