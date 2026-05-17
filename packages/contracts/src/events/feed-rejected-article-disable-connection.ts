import { z } from "zod";

/**
 * Published by: user-feeds-next (when a Discord connection should be disabled — invalid webhook, etc.)
 * Consumed by: backend-api (updates connection state in Mongo)
 *
 * TODO: tighten payload shape — currently consumers parse as `any`.
 */
export const FeedRejectedArticleDisableConnectionSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type FeedRejectedArticleDisableConnectionPayload = z.infer<
  typeof FeedRejectedArticleDisableConnectionSchema
>;
