import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";

import { UpdateUserFeedManagementInviteInput, updateUserFeedManagementInvite } from "../api";

interface Props {
  feedId?: string;
}

export const useUpdateUserFeedManagementInvite = ({ feedId }: Props) => {
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
        if (!feedId) {
          return null;
        }

        return queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === "user-feed" &&
              (query.queryKey[1] as Record<string, unknown>)?.feedId === feedId
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
