import { InferType, object, string } from 'yup';

export const FeedSummarySchema = object({
  id: string().required(),
  title: string().required(),
  status: string().oneOf(['ok', 'failed', 'disabled']).required(),
  url: string().required(),
  channel: string().required(),
  createdAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  failReason: string().optional(),
  disabledReason: string().optional(),
});

export type FeedSummary = InferType<typeof FeedSummarySchema>;
