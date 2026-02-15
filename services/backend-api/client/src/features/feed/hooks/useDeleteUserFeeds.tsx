import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteUserFeeds, DeleteUserFeedsInput, DeleteUserFeedsOutput } from "../api";

export const useDeleteUserFeeds = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error } = useMutation<
    DeleteUserFeedsOutput,
    ApiAdapterError,
    DeleteUserFeedsInput
  >((details) => deleteUserFeeds(details), {
    onSuccess: (res) => {
      return queryClient.invalidateQueries(
        {
          predicate: (query) => {
            const someLegacyDeleted = res.results.some((r) => r.isLegacy);

            return (
              query.queryKey[0] === "user-feeds" ||
              // if legacy feeds were deleted, feed limit will be adjusted
              (someLegacyDeleted && query.queryKey[0] === "discord-user-me")
            );
          },
          refetchType: "all",
          exact: false,
        },
        {
          throwOnError: true,
        },
      );
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
