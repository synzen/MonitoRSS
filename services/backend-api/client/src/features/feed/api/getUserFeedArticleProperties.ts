import {
  array, InferType, object, string,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';

export interface GetUserFeedArticlePropertiesInput {
  feedId: string;
}

const GetUserFeedArticlePropertiesOutputSchema = object({
  result: object().shape({
    requestStatus: string().oneOf(['parse_error', 'pending', 'success']).required(),
    properties: array(string().required()).required(),
  }).required(),
}).required();

export type GetUserFeedArticlePropertiesOutput = InferType<
typeof GetUserFeedArticlePropertiesOutputSchema
>;

export const getUserFeedArticleProperties = async (
  options: GetUserFeedArticlePropertiesInput,
): Promise<GetUserFeedArticlePropertiesOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/article-properties`,
    {
      requestOptions: {
        method: 'GET',
      },
      validateSchema: GetUserFeedArticlePropertiesOutputSchema,
    },
  );

  return res as GetUserFeedArticlePropertiesOutput;
};
