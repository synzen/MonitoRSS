import { bool, InferType, number, object } from "yup";
import fetchRest from "@/utils/fetchRest";

const RetryFailedFeedsOutputSchema = object({
  result: object({
    retriedCount: number().required(),
    recoveryAlreadyActive: bool().required(),
  }).required(),
}).required();

export type RetryFailedFeedsOutput = InferType<typeof RetryFailedFeedsOutputSchema>;

export const retryFailedFeeds = async (workspaceId: string): Promise<RetryFailedFeedsOutput> => {
  const response = await fetchRest("/api/v1/user-feeds/retry-failed", {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    },
    validateSchema: RetryFailedFeedsOutputSchema,
  });

  return response as RetryFailedFeedsOutput;
};
