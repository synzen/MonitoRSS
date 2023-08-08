import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  CreateUserFeedManagementInviteResendInput,
  createUserFeedManagementInviteResend,
} from "../api";

interface Props {
  feedId: string;
}

export const useCreateUserFeedManagementInviteResend = ({ feedId }: Props) => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    CreateUserFeedManagementInviteResendInput
  >((details) => createUserFeedManagementInviteResend(details), {
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
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
