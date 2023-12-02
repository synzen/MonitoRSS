import { InferType, bool, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedDatePreviewInput {
  feedId: string;
  data: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  };
}

const CreateUserFeedDatePreviewOutputSchema = object({
  result: object({
    valid: bool().required(),
    output: string(),
  }).required(),
}).required();

export type CreateUserFeedDatePreviewOutput = InferType<
  typeof CreateUserFeedDatePreviewOutputSchema
>;

export const createUserFeedDatePreview = async (
  options: CreateUserFeedDatePreviewInput
): Promise<CreateUserFeedDatePreviewOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/date-preview`, {
    validateSchema: CreateUserFeedDatePreviewOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.data),
    },
  });

  return res as CreateUserFeedDatePreviewOutput;
};
