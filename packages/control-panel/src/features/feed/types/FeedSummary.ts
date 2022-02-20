import { InferType, object, string } from 'yup';

export const FeedSummarySchema = object({
  id: string(),
  title: string(),
  status: string().oneOf(['ok', 'failed']),
  url: string(),
  channel: string(),
  createdAt: string().transform((value) => new Date(value).toISOString()),
});

export type FeedSummary = InferType<typeof FeedSummarySchema>;
