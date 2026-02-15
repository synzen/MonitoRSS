import { InferType, array, bool, object, string } from "yup";
import fetchRest from "@/utils/fetchRest";

export interface EnableUserFeedsInput {
  data: {
    feeds: Array<{ id: string }>;
  };
}

const EnableUserFeedsOutputSchema = object({
  results: array(
    object({
      id: string().required(),
      enabled: bool().required(),
    }),
  ).required(),
}).required();

export type EnableUserFeedsOutput = InferType<typeof EnableUserFeedsOutputSchema>;

export const EnableUserFeeds = async (
  input: EnableUserFeedsInput,
): Promise<EnableUserFeedsOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-enable",
        data: input.data,
      }),
    },
  });

  return res as EnableUserFeedsOutput;
};
