import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedCloneInput {
  feedId: string;
  details: {
    title?: string;
    url?: string;
  };
}

const CreateUserFeedCloneOutputSchema = object({
  result: object({
    id: string().required(),
  }).required(),
}).required();

export type CreateUserFeedCloneOutput = InferType<typeof CreateUserFeedCloneOutputSchema>;

export const createUserFeedClone = async (
  options: CreateUserFeedCloneInput
): Promise<CreateUserFeedCloneOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/clone`, {
    validateSchema: CreateUserFeedCloneOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as CreateUserFeedCloneOutput;
};
