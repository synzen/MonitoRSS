import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedLegacyRestoreInput {
  feedId: string;
}

const CreateUserFeedLegacyRestoreOutputSchema = object({
  result: object({
    status: string().required(),
  }),
}).required();

export type CreateUserFeedLegacyRestoreOutput = InferType<
  typeof CreateUserFeedLegacyRestoreOutputSchema
>;

export const createUserFeedLegacyRestore = async (
  options: CreateUserFeedLegacyRestoreInput
): Promise<CreateUserFeedLegacyRestoreOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/restore-to-legacy`, {
    validateSchema: CreateUserFeedLegacyRestoreOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
  });

  return res as CreateUserFeedLegacyRestoreOutput;
};
