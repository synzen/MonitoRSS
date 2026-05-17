import { z } from "zod";

/**
 * Published by: discord-rest-listener (after attempting Discord delivery)
 * Consumed by: user-feeds-next, backend-api
 *
 * Carries the delivery outcome per article so the pipeline can record success,
 * trigger retries, or disable feeds on hard failures.
 *
 * TODO: tighten payload shape — currently consumers parse this loosely.
 */
export const FeedArticleDeliveryResultSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type FeedArticleDeliveryResultPayload = z.infer<typeof FeedArticleDeliveryResultSchema>;
