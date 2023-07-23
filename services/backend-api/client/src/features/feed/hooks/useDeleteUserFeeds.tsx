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
    onSuccess: () =>
      queryClient.invalidateQueries(
        {
          queryKey: ["user-feeds"],
          exact: false,
        },
        {
          throwOnError: true,
        }
      ),
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
