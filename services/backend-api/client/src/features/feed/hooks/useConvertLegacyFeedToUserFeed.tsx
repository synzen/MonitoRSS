import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetConvertFeedToUserFeedInput,
  GetConvertFeedToUserFeedOutput,
  getConvertFeedToUserFeed,
} from "../api";

export const useConvertLegacyFeedToUserFeed = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    GetConvertFeedToUserFeedOutput,
    ApiAdapterError,
    GetConvertFeedToUserFeedInput
  >((details) => getConvertFeedToUserFeed(details), {
    onSuccess: (data, inputData) => {
      return Promise.all([
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === "feed" &&
                // @ts-ignore
                query.queryKey[1]?.feedId === inputData.feedId) ||
              query.queryKey[0] === "feeds" ||
              query.queryKey[0] === "user-feeds" ||
              query.queryKey[0] === "discord-user-me"
            );
          },
          refetchType: "all",
        }),
      ]);
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
