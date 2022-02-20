import {
  array, InferType, number, object,
} from 'yup';
import { FeedSummarySchema } from '../types';
import fetchRest from '../../../utils/fetchRest';

export interface GetFeedsInput {
  serverId: string;
  limit?: number;
  offset?: number;
}

const GetFeedsOutputSchema = object({
  results: array(FeedSummarySchema).required(),
  total: number().required(),
}).required();

export type GetFeedsOutput = InferType<typeof GetFeedsOutputSchema>;

export const getFeeds = async (options: GetFeedsInput): Promise<GetFeedsOutput> => {
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
