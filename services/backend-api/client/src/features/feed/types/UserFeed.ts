import { InferType, object, string } from 'yup';

export const UserFeedSchema = object({
  id: string().required(),
  title: string().required(),
  url: string().required(),
  createdAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  updatedAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  status: string().oneOf(['ok', 'failed', 'disabled', 'failing']).required(),
});

export type UserFeed = InferType<typeof UserFeedSchema>;
