import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetConvertFeedToUserFeedInput {
  feedId: string;
}

const GetConvertFeedToUserFeedSchema = object({
  result: object({
    id: string().required(),
  }).required(),
}).required();

export type GetConvertFeedToUserFeedOutput = InferType<typeof GetConvertFeedToUserFeedSchema>;

export const getConvertFeedToUserFeed = async (
  options: GetConvertFeedToUserFeedInput
): Promise<GetConvertFeedToUserFeedOutput> => {
  const res = await fetchRest(`/api/v1/feeds/${options.feedId}/user-feed`, {
    validateSchema: GetConvertFeedToUserFeedSchema,
  });

  return res as GetConvertFeedToUserFeedOutput;
};
