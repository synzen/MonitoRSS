import { z } from "zod";

/**
 * Published by: feed-requests (when a URL is repeatedly failing but not yet at the disable threshold)
 * Consumed by: backend-api (to surface in dashboards / notify the user)
 */
export const UrlFailingSchema = z.object({
  data: z.object({
    url: z.string(),
    lookupKey: z.string().optional(),
  }),
});

export type UrlFailingPayload = z.infer<typeof UrlFailingSchema>;
