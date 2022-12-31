import qs from 'qs';
import {
  array, boolean, InferType, object, string,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { GetArticlesFilterReturnType } from '../constants';

export interface GetUserFeedArticlesInput {
  feedId: string;
  data: {
    limit: number
    random?: boolean
    selectProperties?: string[]
    filters?: {
      expression: Record<string, any>
      returnType: GetArticlesFilterReturnType
    }
  }
}

const GetUserFeedArticlesOutputSchema = object({
  result: object().shape({
    requestStatus: string().oneOf(['parse_error', 'pending', 'success']).required(),
    articles: array(object()).required(),
    selectedProperties: array(string().required()).optional().default([]),
    filterStatuses: array(
      object({
        passed: boolean().required(),
      }).required(),
    ).optional().default([]),
  }).required(),
}).required();

export type GetUserFeedArticlesOutput = InferType<typeof GetUserFeedArticlesOutputSchema>;

export const getUserFeedArticles = async (
  options: GetUserFeedArticlesInput,
): Promise<GetUserFeedArticlesOutput> => {
  const params = qs.stringify(options.data);

  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/get-articles?${params}`,
    {
      requestOptions: {
        method: 'POST',
        body: JSON.stringify(options.data),
      },
      validateSchema: GetUserFeedArticlesOutputSchema,
    },
  );

  return res as GetUserFeedArticlesOutput;
};
