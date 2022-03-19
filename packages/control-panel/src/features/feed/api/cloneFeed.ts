import { array, InferType, object } from 'yup';
import { FeedSchema, FeedCloneProperties } from '../types';
import fetchRest from '@/utils/fetchRest';

export interface CloneFeedInput {
  feedId: string
  details: {
    targetFeedIds: string[]
    properties: FeedCloneProperties[]
  }
}

const CloneFeedOutputSchema = object({
  results: array(FeedSchema).required(),
});

export type CloneFeedOutput = InferType<typeof CloneFeedOutputSchema>;

export const cloneFeed = async (options: CloneFeedInput): Promise<CloneFeedOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/clone`,
  {
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
    validateSchema: CloneFeedOutputSchema,
  },
);
