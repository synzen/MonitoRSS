import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { DisableUserFeeds, DisableUserFeedsInput, DisableUserFeedsOutput } from "../api";

export const useDisableUserFeeds = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error } = useMutation<
    DisableUserFeedsOutput,
    ApiAdapterError,
    DisableUserFeedsInput
  >((details) => DisableUserFeeds(details), {
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
