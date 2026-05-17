import { z } from "zod";

/**
 * Published by: feed-requests (when a URL has exceeded the failure threshold)
 * Consumed by: backend-api (disables affected user-feeds)
 */
export const UrlFailedDisableFeedsSchema = z.object({
  data: z.object({
    url: z.string(),
    lookupKey: z.string().optional(),
  }),
});

export type UrlFailedDisableFeedsPayload = z.infer<typeof UrlFailedDisableFeedsSchema>;
