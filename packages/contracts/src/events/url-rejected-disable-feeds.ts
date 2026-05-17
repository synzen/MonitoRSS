import { z } from "zod";

/**
 * Published by: feed-requests
 * Consumed by: backend-api
 *
 * TODO: The current consumer (backend-api/src/services/message-broker-events/message-broker-events.service.ts)
 * accepts this payload as `any`. Tighten this schema when the producer side is canonicalized.
 */
export const UrlRejectedDisableFeedsSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type UrlRejectedDisableFeedsPayload = z.infer<typeof UrlRejectedDisableFeedsSchema>;
