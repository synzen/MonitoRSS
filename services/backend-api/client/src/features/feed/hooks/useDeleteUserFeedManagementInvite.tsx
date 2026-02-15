import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteUserFeedManagementInvite, DeleteUserFeedManagementInviteInput } from "../api";

export const useDeleteUserFeedManagementInvite = ({ feedId }: { feedId: string }) => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiAdapterError, DeleteUserFeedManagementInviteInput>(
    (details) => deleteUserFeedManagementInvite(details),
    {
      onSuccess: () => {
        return queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === "user-feed" &&
              (query.queryKey[1] as Record<string, any>).feedId === feedId
            );
          },
        });
      },
    },
  );
};
