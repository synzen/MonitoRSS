import { InferType, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedArticleRequestStatus } from "../types";

export interface CreateUserManualRequestInput {
  feedId: string;
}

const CreateUserFeedManualRequestOutputSchema = object({
  result: object({
    requestStatus: string().oneOf(Object.values(UserFeedArticleRequestStatus)).required(),
    requestStatusCode: number(),
  }).required(),
}).required();

export type CreateUserFeedManualRequestOutput = InferType<
  typeof CreateUserFeedManualRequestOutputSchema
>;

export const createUserFeedManualRequest = async (
  options: CreateUserManualRequestInput
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
