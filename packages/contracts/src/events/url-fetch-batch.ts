import { z } from "zod";

/**
 * Published by: backend-api (schedule-emitter, via MessageBrokerService.publishUrlFetchBatch)
 * Consumed by: feed-requests
 *
 * A batch of URLs to fetch at a given refresh cadence. The `rateSeconds` field
 * matches the queue's expiration so stale batches drop if not consumed in time.
 */
export const UrlFetchBatchSchema = z.object({
  rateSeconds: z.number().int().positive(),
  timestamp: z.number().int(),
  data: z.array(
    z.object({
      url: z.string().url(),
      saveToObjectStorage: z.boolean().optional(),
      lookupKey: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

export type UrlFetchBatchPayload = z.infer<typeof UrlFetchBatchSchema>;
