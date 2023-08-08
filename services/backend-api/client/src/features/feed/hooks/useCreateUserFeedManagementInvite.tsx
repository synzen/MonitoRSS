import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  CreateUserFeedManagementInviteInput,
  CreateUserFeedManagementInviteOutput,
  createUserFeedManagementInvite,
} from "../api";

export const useCreateUserFeedManagementInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedManagementInviteOutput,
    ApiAdapterError,
    CreateUserFeedManagementInviteInput
  >((details) => createUserFeedManagementInvite(details), {
    onSuccess: (res, input) => {
      return queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === "user-feed" &&
            (query.queryKey[1] as Record<string, any>).feedId === input.data.feedId
          );
        },
      });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
