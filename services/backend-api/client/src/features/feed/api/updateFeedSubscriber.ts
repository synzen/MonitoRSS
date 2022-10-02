import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedSubscriberSchema } from '../types/FeedSubscriber';

export interface UpdateFeedSubscriberInput {
  feedId: string
  subscriberId: string
  details?: {
    filters?: Array<{ category: string, value: string }>
  }
}

const UpdateFeedSubscriberOutputSchema = object({
  result: FeedSubscriberSchema.required(),
}).required();

export type UpdateFeedSubscriberOutput = InferType<typeof UpdateFeedSubscriberOutputSchema>;

export const updateFeedSubscriber = async (
  options: UpdateFeedSubscriberInput,
): Promise<UpdateFeedSubscriberOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/subscribers/${options.subscriberId}`,
    {
      validateSchema: UpdateFeedSubscriberOutputSchema,
      requestOptions: {
        method: 'PATCH',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as UpdateFeedSubscriberOutput;
};
