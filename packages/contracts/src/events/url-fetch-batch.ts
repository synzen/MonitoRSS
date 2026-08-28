import { z } from "zod";

/**
 * Published by: backend-api (schedule-emitter, via MessageBrokerService.publishUrlFetchBatch)
 * Consumed by: feed-requests
 *
 * A batch of URLs to fetch at a given refresh cadence. The `rateSeconds` field
 * matches the queue's expiration so stale batches drop if not consumed in time.
 *
 * `recovery` marks the item as a bulk-recovery attempt for feeds that were
 * disabled with FAILED_REQUESTS and are now being re-verified in the
 * background. `startedAt` is the epoch-ms timestamp of the recovery transition;
 * the consumer uses it to ignore failure history that predates the recovery
 * cycle (old terminal failure counts, stale backoff dates, and cached
 * responses) so the first recovery attempt performs a fresh request.
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
      recovery: z
        .object({
          startedAt: z.number().int().positive(),
        })
        .optional(),
    }),
  ),
});

export type UrlFetchBatchPayload = z.infer<typeof UrlFetchBatchSchema>;
