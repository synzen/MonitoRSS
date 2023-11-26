import { array, InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedArticleRequestStatus } from "../types";
import { CustomPlaceholder } from "../../../types";

export interface GetUserFeedArticlePropertiesInput {
  feedId: string;
  data: {
    customPlaceholders?: CustomPlaceholder[] | null;
  };
}

const GetUserFeedArticlePropertiesOutputSchema = object({
  result: object()
    .shape({
      requestStatus: string().oneOf(Object.values(UserFeedArticleRequestStatus)).required(),
      properties: array(string().required()).required(),
    })
    .required(),
}).required();

export type GetUserFeedArticlePropertiesOutput = InferType<
  typeof GetUserFeedArticlePropertiesOutputSchema
>;

export const getUserFeedArticleProperties = async (
  options: GetUserFeedArticlePropertiesInput
): Promise<GetUserFeedArticlePropertiesOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/get-article-properties`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.data),
    },
    validateSchema: GetUserFeedArticlePropertiesOutputSchema,
  });

  return res as GetUserFeedArticlePropertiesOutput;
};
