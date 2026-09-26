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
 *
 * `trigger` is request metadata describing why the fetch happened (ADR-009).
 * It is copied through to the url.fetch.completed event without interpretation.
 * Absent and `kind: "interval"` triggers are treated identically by consumers,
 * which keeps rolling deploys safe in both directions: old producers emit
 * trigger-less items (interval semantics) and old consumers strip the unknown
 * field instead of failing validation.
 */
export const UrlFetchTriggerSchema = z.object({
  kind: z.enum(["interval", "scheduled"]).default("interval"),
  occurredAt: z.number().int().positive(),
});

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
      trigger: UrlFetchTriggerSchema.optional(),
    }),
  ),
});

export type UrlFetchTrigger = z.infer<typeof UrlFetchTriggerSchema>;

export type UrlFetchBatchPayload = z.infer<typeof UrlFetchBatchSchema>;
