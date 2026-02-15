import { InferType, array, bool, object, string } from "yup";
import fetchRest from "@/utils/fetchRest";

export interface DisableUserFeedsInput {
  data: {
    feeds: Array<{ id: string }>;
  };
}

const DisableUserFeedsOutputSchema = object({
  results: array(
    object({
      id: string().required(),
      disabled: bool().required(),
    }),
  ).required(),
}).required();

export type DisableUserFeedsOutput = InferType<typeof DisableUserFeedsOutputSchema>;

export const DisableUserFeeds = async (
  input: DisableUserFeedsInput,
): Promise<DisableUserFeedsOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-disable",
        data: input.data,
      }),
    },
  });

  return res as DisableUserFeedsOutput;
};
