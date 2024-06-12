import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createUserFeedManualRequest,
  CreateUserFeedManualRequestOutput,
  CreateUserManualRequestInput,
} from "../api";

export const useCreateUserFeedManualRequest = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedManualRequestOutput,
    ApiAdapterError,
    CreateUserManualRequestInput
  >((details) => createUserFeedManualRequest(details), {
    onSuccess: (_, input) => {
      return queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === "user-feed-articles" &&
              (query.queryKey[1] as { feedId?: string })?.feedId === input.feedId) ||
            (query.queryKey[0] === "user-feed-article-properties" &&
              (query.queryKey[1] as { feedId?: string })?.feedId === input.feedId) ||
            (query.queryKey[0] === "user-feed-requests" &&
              (query.queryKey[1] as { feedId?: string })?.feedId === input.feedId) ||
            (query.queryKey[0] === "user-feed" &&
              (query.queryKey[1] as { feedId?: string })?.feedId === input.feedId)
          );
        },
        exact: false,
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
