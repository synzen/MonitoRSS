import { z } from "zod";

/**
 * Published by: backend-api (when a user-feed is deleted)
 * Consumed by: user-feeds-next (cleans up Redis locks, delivery records, etc.)
 */
export const FeedDeletedSchema = z.object({
  data: z.object({
    feedId: z.string(),
  }),
});

export type FeedDeletedPayload = z.infer<typeof FeedDeletedSchema>;
