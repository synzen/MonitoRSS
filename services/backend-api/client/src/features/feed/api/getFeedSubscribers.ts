import {
  array, InferType, number, object,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedSubscriberSchema } from '../types/FeedSubscriber';

export interface GetFeedSubscribersInput {
  feedId: string
}

const GetFeedSubscribersOutputSchema = object({
  results: array(FeedSubscriberSchema).required(),
  total: number().required(),
}).required();

export type GetFeedSubscribersOutput = InferType<typeof GetFeedSubscribersOutputSchema>;

export const getFeedSubscribers = async (
  options: GetFeedSubscribersInput,
): Promise<GetFeedSubscribersOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/subscribers`,
    {
      validateSchema: GetFeedSubscribersOutputSchema,
    },
  );

  return res as GetFeedSubscribersOutput;
};
