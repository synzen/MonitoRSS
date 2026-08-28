import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  retryFailedFeeds,
  type RetryFailedFeedsOutput,
} from "../api";

export const useRetryFailedFeeds = () => {
  const queryClient = useQueryClient();

  return useMutation<RetryFailedFeedsOutput, ApiAdapterError, string>(retryFailedFeeds, {
    onSuccess: async () => {
      await queryClient.invalidateQueries(["user-feeds"]);
    },
  });
};
