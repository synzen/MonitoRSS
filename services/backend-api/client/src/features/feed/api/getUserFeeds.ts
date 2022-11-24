import {
  array, InferType, number, object, string,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { UserFeedDisabledCode, UserFeedHealthStatus } from '../types';

export interface GetUserFeedsInput {
  limit?: number;
  offset?: number;
  search?: string
}

const GetUserFeedsOutputSchema = object({
  results: array(object({
    id: string().required(),
    title: string().required(),
    url: string().required(),
    healthStatus: string().oneOf(Object.values(UserFeedHealthStatus)).required(),
    disabledCode: string().oneOf(Object.values(UserFeedDisabledCode)).optional(),
  })).required(),
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
