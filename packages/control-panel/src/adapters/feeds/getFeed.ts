import { z } from 'zod';
import { FeedSchema } from '../../types/Feed';
import fetchRest from '../utils/fetchRest';

export interface GetFeedInput {
  serverId: string
  feedId: string
}

const GetFeedOutputSchema = z.object({
  result: FeedSchema,
});

export type GetFeedOutput = z.infer<typeof GetFeedOutputSchema>;

const getFeed = async (options: GetFeedInput): Promise<GetFeedOutput> => fetchRest(
  `/api/v1/servers/${options.serverId}/feeds/${options.feedId}`,
  {
    validateSchema: GetFeedOutputSchema,
  },
);

export default getFeed;
