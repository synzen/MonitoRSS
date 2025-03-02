import { array, InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedDeduplicatedUrlsInput {
  details: {
    urls: string[];
  };
}

const CreateUserFeedDeduplicatedUrlsOutputSchema = object({
  result: object({
    urls: array(string().required()).required(),
  }).required(),
}).required();

export type CreateUserFeedDeduplicatedUrlsOutput = InferType<
  typeof CreateUserFeedDeduplicatedUrlsOutputSchema
>;

export const createUserFeedDeduplicatedUrls = async (
  options: CreateUserFeedDeduplicatedUrlsInput
): Promise<CreateUserFeedDeduplicatedUrlsOutput> => {
  const res = await fetchRest("/api/v1/user-feeds/deduplicate-feed-urls", {
    validateSchema: CreateUserFeedDeduplicatedUrlsOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as CreateUserFeedDeduplicatedUrlsOutput;
};
