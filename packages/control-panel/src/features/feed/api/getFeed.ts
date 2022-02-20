import { z } from 'zod';
import { FeedSchema } from '../types/Feed';
import fetchRest from '../../../utils/fetchRest';

export interface GetFeedInput {
  feedId: string
}

const GetFeedOutputSchema = z.object({
  result: FeedSchema,
});

export type GetFeedOutput = z.infer<typeof GetFeedOutputSchema>;

export const getFeed = async (options: GetFeedInput): Promise<GetFeedOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}`,
  {
    validateSchema: GetFeedOutputSchema,
  },
);
