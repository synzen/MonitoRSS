import * as z from 'zod'

export const ConfigSchema = z.object({
  token: z.string(),
  databaseURI: z.string(),
  maxRequestsPerSecond: z.number(),
  rabbitmqUri: z.string(),
  discordClientId: z.string(),
  datadog: z.object({
    apiKey: z.string(),
    host: z.string(),
    service: z.string(),
  }).optional(),
})

export type ConfigType = z.infer<typeof ConfigSchema>
