import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { updateFeed, UpdateFeedInput, UpdateFeedOutput } from "../api";

export const useUpdateFeed = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    UpdateFeedOutput,
    ApiAdapterError,
    UpdateFeedInput
  >((details) => updateFeed(details), {
    onSuccess: (data, inputData) => {
      queryClient.setQueryData(
        [
          "feed",
          {
            feedId: inputData.feedId,
          },
        ],
        data
      );

      return queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === "user-feed-articles" &&
            // @ts-ignore
            query.queryKey[1]?.feedId === inputData.feedId
          );
        },
      });
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
