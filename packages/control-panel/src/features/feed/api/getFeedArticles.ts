import { array, InferType, object } from 'yup';
import { FeedArticlesSchema } from '../types';
import fetchRest from '../../../utils/fetchRest';

export interface GetFeedArticlesInput {
  feedId: string
}

const GetFeedArticlesSchema = object({
  result: array(FeedArticlesSchema),
});

export type GetFeedArticlesOutput = InferType<typeof GetFeedArticlesSchema>;

export const getFeedArticles = async (
  options: GetFeedArticlesInput,
): Promise<GetFeedArticlesOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/articles`,
  {
    validateSchema: GetFeedArticlesSchema,
  },
);
