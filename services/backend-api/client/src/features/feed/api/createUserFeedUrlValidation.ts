import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedUrlValidationInput {
  details: {
    url: string;
    // Existing feed being re-URLed. Validation uses its premium slot instead
    // of treating the replacement URL as a new premium feed.
    feedId?: string;
    // In workspace scope, reddit-connection checks resolve against the workspace's
    // connection instead of the caller's personal one.
    workspaceId?: string;
  };
}

const CreateUserFeedUrlValidationOutputSchema = object({
  result: object({
    resolvedToUrl: string().optional().nullable(),
    feedTitle: string().optional(),
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
