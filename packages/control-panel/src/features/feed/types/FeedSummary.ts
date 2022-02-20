import { InferType, object, string } from 'yup';

export const FeedSummarySchema = object({
  id: string().required(),
  title: string().required(),
  status: string().oneOf(['ok', 'failed']).required(),
  url: string().required(),
  channel: string().required(),
  createdAt: string().transform((value) => new Date(value).toISOString()).required(),
});

export type FeedSummary = InferType<typeof FeedSummarySchema>;
