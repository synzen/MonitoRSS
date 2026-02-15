import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { EnableUserFeeds, EnableUserFeedsInput, EnableUserFeedsOutput } from "../api";

export const useEnableUserFeeds = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error } = useMutation<
    EnableUserFeedsOutput,
    ApiAdapterError,
    EnableUserFeedsInput
  >((details) => EnableUserFeeds(details), {
    onSuccess: () =>
      queryClient.invalidateQueries(
        {
          queryKey: ["user-feeds"],
          exact: false,
        },
        {
          throwOnError: true,
        },
      ),
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
