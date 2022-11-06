import {
  array, InferType, number, object,
} from 'yup';
import { UserFeedSchema } from '../types';
import fetchRest from '../../../utils/fetchRest';

export interface GetUserFeedsInput {
  limit?: number;
  offset?: number;
  search?: string
}

const GetUserFeedsOutputSchema = object({
  results: array(UserFeedSchema).required(),
  total: number().required(),
}).required();

export type GetUserFeedsOutput = InferType<typeof GetUserFeedsOutputSchema>;

export const getUserFeeds = async (options: GetUserFeedsInput): Promise<GetUserFeedsOutput> => {
  const searchParams = new URLSearchParams({
    limit: options.limit?.toString() || '10',
    offset: options.offset?.toString() || '0',
    search: options.search || '',
  });

  const res = await fetchRest(
    `/api/v1/user-feeds?${searchParams}`,
    {
      validateSchema: GetUserFeedsOutputSchema,
    },
  );

  return res as GetUserFeedsOutput;
};
