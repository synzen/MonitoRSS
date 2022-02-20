import { z } from 'zod';

export const FeedSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['ok', 'failed']),
  url: z.string(),
  channel: z.string(),
});

export type FeedSummary = z.infer<typeof FeedSummarySchema>;
