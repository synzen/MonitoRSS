import {
  array, InferType, object, string,
} from 'yup';

export const FeedSubscriberSchema = object({
  id: string().required(),
  type: string().oneOf(['user', 'role']).required(),
  discordId: string().required(),
  filters: array(object({
    category: string().required(),
    value: string().required(),
  })).required(),
  feed: string().required(),
});

export type FeedSubscriber = InferType<typeof FeedSubscriberSchema>;
