import { InferType, object } from 'yup';
import { FeedSchema } from '@/types/Feed';
import fetchRest from '../../../utils/fetchRest';

export interface RefreshFeedInput {
  feedId: string
}

const RefreshFeedOutputSchema = object({
  result: FeedSchema,
}).required();

export type RefreshFeedOutput = InferType<typeof RefreshFeedOutputSchema>;

export const refreshFeed = async (options: RefreshFeedInput): Promise<
RefreshFeedOutput
> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/refresh`,
    {
      validateSchema: RefreshFeedOutputSchema,
    },
  );

  return res as RefreshFeedOutput;
};
