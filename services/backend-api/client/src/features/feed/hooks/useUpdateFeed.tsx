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
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
