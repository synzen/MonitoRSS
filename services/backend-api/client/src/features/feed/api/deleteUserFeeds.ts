import { InferType, array, bool, object, string } from "yup";
import fetchRest from "@/utils/fetchRest";

export interface DeleteUserFeedsInput {
  data: {
    feeds: Array<{ id: string }>;
  };
}

const GetUserFeedsOutputSchema = object({
  results: array(
    object({
      id: string().required(),
      deleted: bool().required(),
      isLegacy: bool().required(),
    }),
  ).required(),
}).required();

export type DeleteUserFeedsOutput = InferType<typeof GetUserFeedsOutputSchema>;

export const deleteUserFeeds = async (
  input: DeleteUserFeedsInput,
): Promise<DeleteUserFeedsOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-delete",
        data: input.data,
      }),
    },
  });

  return res as DeleteUserFeedsOutput;
};
