import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedSubscriberSchema } from '../types/FeedSubscriber';

export interface CreateFeedSubscribersInput {
  feedId: string
  details: {
    type: 'role' | 'user'
    discordId: string
  }
}

const CreateFeedSubscriberOutputSchema = object({
  result: FeedSubscriberSchema.required(),
}).required();

export type CreateFeedSubscriberOutput = InferType<typeof CreateFeedSubscriberOutputSchema>;

export const createFeedSubscriber = async (
  options: CreateFeedSubscribersInput,
): Promise<CreateFeedSubscriberOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/subscribers`,
  {
    validateSchema: CreateFeedSubscriberOutputSchema,
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
  },
);
