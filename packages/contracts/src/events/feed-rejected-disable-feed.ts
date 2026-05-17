import { z } from "zod";

/**
 * Published by: user-feeds-next (when a feed should be disabled — invalid feed, exceeded limits, etc.)
 * Consumed by: backend-api (updates feed state in Mongo)
 *
 * TODO: tighten payload shape — currently consumers parse as `any`.
 */
export const FeedRejectedDisableFeedSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type FeedRejectedDisableFeedPayload = z.infer<typeof FeedRejectedDisableFeedSchema>;
