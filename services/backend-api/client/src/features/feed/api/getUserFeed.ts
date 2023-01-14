import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedSchema } from "../types";

export interface GetUserFeedInput {
  feedId: string;
}

const GetUserFeedOutputSchema = object({
  result: UserFeedSchema,
}).required();

export type GetUserFeedOutput = InferType<typeof GetUserFeedOutputSchema>;

export const getUserFeed = async (options: GetUserFeedInput): Promise<GetUserFeedOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}`, {
    validateSchema: GetUserFeedOutputSchema,
  });

  return res as GetUserFeedOutput;
};
