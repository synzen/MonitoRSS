import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedUrlValidationInput {
  details: {
    url: string;
  };
}

const CreateUserFeedUrlValidationOutputSchema = object({
  result: object({
    resolvedToUrl: string().optional().nullable(),
  }),
}).required();

export type CreateUserFeedUrlValidationOutput = InferType<
  typeof CreateUserFeedUrlValidationOutputSchema
>;

export const createUserFeedUrlValidation = async (
  options: CreateUserFeedUrlValidationInput,
): Promise<CreateUserFeedUrlValidationOutput> => {
  const res = await fetchRest("/api/v1/user-feeds/url-validation", {
    validateSchema: CreateUserFeedUrlValidationOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as CreateUserFeedUrlValidationOutput;
};
