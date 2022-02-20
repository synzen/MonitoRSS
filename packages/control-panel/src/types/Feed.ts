import { z } from 'zod';

export const FeedSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['ok', 'failed']),
  url: z.string(),
  channel: z.string(),
});

export type Feed = z.infer<typeof FeedSchema>;
