import { z } from "zod";

export const mediumRateLimitSchema = z.object({
  timeWindowSeconds: z.number(),
  limit: z.number(),
});

export type MediumRateLimit = z.infer<typeof mediumRateLimitSchema>;
