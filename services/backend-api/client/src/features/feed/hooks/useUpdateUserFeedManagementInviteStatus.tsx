import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  UpdateUserFeedManagementInviteStatusInput,
  updateUserFeedManagementInviteStatus,
} from "../api/updateUserFeedManagementInviteStatus";

export const useUpdateUserFeedManagementInviteStatus = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    UpdateUserFeedManagementInviteStatusInput
  >(
    async (details) => {
      await updateUserFeedManagementInviteStatus(details);
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
