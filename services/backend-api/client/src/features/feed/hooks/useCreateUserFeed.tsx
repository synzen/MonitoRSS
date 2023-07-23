import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createUserFeed, CreateUserFeedInput, CreateUserFeedOutput } from "../api";

export const useCreateUserFeed = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedOutput,
    ApiAdapterError,
    CreateUserFeedInput
  >((details) => createUserFeed(details), {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-feeds"],
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
