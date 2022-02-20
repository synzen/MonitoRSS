import { z } from 'zod';
import { FeedArticlesSchema } from '../types';
import fetchRest from '../../../utils/fetchRest';

export interface GetFeedArticlesInput {
  feedId: string
}

const GetFeedArticlesSchema = z.object({
  result: z.array(FeedArticlesSchema),
});

export type GetFeedArticlesOutput = z.infer<typeof GetFeedArticlesSchema>;

export const getFeedArticles = async (
  options: GetFeedArticlesInput,
): Promise<GetFeedArticlesOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/articles`,
  {
    validateSchema: GetFeedArticlesSchema,
  },
);
