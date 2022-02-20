import { z } from 'zod';
import { FeedSummarySchema } from '../../types/FeedSummary';
import fetchRest from '../utils/fetchRest';

export interface GetFeedsInput {
  serverId: string;
  limit?: number;
  offset?: number;
}

const GetFeedsOutputSchema = z.object({
  results: z.array(FeedSummarySchema),
  total: z.number(),
});

export type GetFeedsOutput = z.infer<typeof GetFeedsOutputSchema>;

const getFeeds = async (options: GetFeedsInput): Promise<GetFeedsOutput> => {
  const searchParams = new URLSearchParams({
    limit: options.limit?.toString() || '10',
    offset: options.offset?.toString() || '0',
  });

  return fetchRest(
    `/api/v1/servers/${options.serverId}/feeds?${searchParams}`,
    {
      validateSchema: GetFeedsOutputSchema,
    },
  );
};

export default getFeeds;
