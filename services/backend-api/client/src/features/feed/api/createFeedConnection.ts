import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface CreateFeedConnectionInput {
  feedId: string
  details: {
    channelId: string
  }
}

const CreateFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type CreateFeedConnectionOutput = {
  result: FeedConnection
};

export const createFeedConnection = async (
  options: CreateFeedConnectionInput,
): Promise<CreateFeedConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections`,
  {
    validateSchema: CreateFeedConnectionOutputSchema,
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
  },
);
