import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  UpdateAcceptUserFeedManagementInviteInput,
  updateAcceptUserFeedManagementInvite,
} from "../api/updateAcceptUserFeedManagementInvite";

export const useUpdateAcceptUserFeedManagementInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    UpdateAcceptUserFeedManagementInviteInput
  >(
    async (details) => {
      await updateAcceptUserFeedManagementInvite(details);
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
