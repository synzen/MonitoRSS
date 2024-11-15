import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetUserFeedOutput,
  refreshUserFeed,
  RefreshUserFeedInput,
  RefreshUserFeedOutput,
} from "../api";

export const useRefreshUserFeed = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    RefreshUserFeedOutput,
    ApiAdapterError,
    RefreshUserFeedInput
  >((details) => refreshUserFeed(details), {
    onSuccess: (data, inputData) => {
      queryClient.setQueryData<GetUserFeedOutput>(
        [
          "user-feed",
          {
            feedId: inputData.feedId,
          },
        ],
        data
      );

      return queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "user-feeds" || query.queryKey[0] === "user-feed-requests",
      });
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
