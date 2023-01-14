import * as z from 'zod'

export const ConfigSchema = z.object({
  token: z.string(),
  databaseURI: z.string(),
  maxRequestsPerSecond: z.number(),
  rabbitmqUri: z.string(),
  discordClientId: z.string(),
  datadog: z.object({
    apiKey: z.string().optional(),
    host: z.string().optional(),
    service: z.string().optional(),
  }).optional(),
})

export type ConfigType = z.infer<typeof ConfigSchema>
