import { z } from "zod";

/**
 * Published by: feed-requests (after a successful URL fetch)
 * Consumed by: backend-api (message-broker-events) and user-feeds-next
 */
export const UrlFetchCompletedSchema = z.object({
  data: z.object({
    url: z.string(),
    lookupKey: z.string().optional(),
    rateSeconds: z.number().int().positive(),
    debug: z.boolean().optional(),
  }),
});

export type UrlFetchCompletedPayload = z.infer<typeof UrlFetchCompletedSchema>;
