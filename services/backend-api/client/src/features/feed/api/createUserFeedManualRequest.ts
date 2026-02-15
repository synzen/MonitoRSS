import { InferType, number, object, string, boolean } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedArticleRequestStatus } from "../types";
import { UserFeedUrlRequestStatus } from "../types/UserFeedUrlRequestStatus";

export interface CreateUserManualRequestInput {
  feedId: string;
}

const CreateUserFeedManualRequestOutputSchema = object({
  result: object({
    requestStatus: string().oneOf(Object.values(UserFeedUrlRequestStatus)).required(),
    getArticlesRequestStatus: string()
      .oneOf(Object.values(UserFeedArticleRequestStatus))
      .optional()
      .nullable(),
    requestStatusCode: number(),
    hasEnabledFeed: boolean().optional().nullable(),
  }).required(),
}).required();

export type CreateUserFeedManualRequestOutput = InferType<
  typeof CreateUserFeedManualRequestOutputSchema
>;

export const createUserFeedManualRequest = async (
  options: CreateUserManualRequestInput,
): Promise<CreateUserFeedManualRequestOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/manual-request`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
    validateSchema: CreateUserFeedManualRequestOutputSchema,
  });

  return res as CreateUserFeedManualRequestOutput;
};
