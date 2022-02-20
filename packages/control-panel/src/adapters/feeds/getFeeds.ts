import { z } from 'zod';
import { FeedSchema } from '../../types/Feed';
import fetchRest from '../utils/fetchRest';

export interface GetFeedsInput {
  serverId: string;
  limit?: number;
  offset?: number;
}

const GetFeedsOutputSchema = z.object({
  results: z.array(FeedSchema),
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
