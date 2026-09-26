import { z } from "zod";
import { UrlFetchTriggerSchema } from "./url-fetch-batch";

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
    recovery: z.object({ startedAt: z.number().int().positive() }).optional(),
    // Request metadata copied through from the url.fetch-batch entry (ADR-009).
    // Absent triggers carry interval semantics so rolling deploys are safe.
    trigger: UrlFetchTriggerSchema.optional(),
  }),
});

export type UrlFetchCompletedPayload = z.infer<typeof UrlFetchCompletedSchema>;
