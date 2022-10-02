import { InferType, object } from 'yup';
import { FeedSchema } from '../../../types/Feed';
import fetchRest from '../../../utils/fetchRest';

export interface CreateFeedInput {
  details: {
    channelId: string
    feeds: Array<{
      title: string;
      url: string;
    }>
  }
}

const CreateFeedOutputSchema = object({
  result: FeedSchema,
}).required();

export type CreateFeedOutput = InferType<typeof CreateFeedOutputSchema>;

export const createFeed = async (options: CreateFeedInput): Promise<CreateFeedOutput> => {
  const res = await fetchRest(
    '/api/v1/feeds',
    {
      validateSchema: CreateFeedOutputSchema,
      requestOptions: {
        method: 'POST',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as CreateFeedOutput;
};
