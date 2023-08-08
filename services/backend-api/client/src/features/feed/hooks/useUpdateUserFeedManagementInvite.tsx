import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { UpdateUserFeedManagementInviteInput, updateUserFeedManagementInvite } from "../api";

export const useUpdateUserFeedManagementInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    UpdateUserFeedManagementInviteInput
  >(
    async (details) => {
      await updateUserFeedManagementInvite(details);
    },
    {
      onSuccess: () => {
        return queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === "user-feeds" ||
              query.queryKey[0] === "user-feed-management-invites" ||
              query.queryKey[0] === "user-feed-management-invites-count"
            );
          },
        });
      },
    }
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
