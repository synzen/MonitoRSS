import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedSchema } from "../types";

export interface CreateUserFeedInput {
  details: {
    title?: string;
    url: string;
  };
}

const CreateFeedOutputSchema = object({
  result: UserFeedSchema,
}).required();

export type CreateUserFeedOutput = InferType<typeof CreateFeedOutputSchema>;

export const createUserFeed = async (
  options: CreateUserFeedInput
): Promise<CreateUserFeedOutput> => {
  const res = await fetchRest("/api/v1/user-feeds", {
    validateSchema: CreateFeedOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as CreateUserFeedOutput;
};
