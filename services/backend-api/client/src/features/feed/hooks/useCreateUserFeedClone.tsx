import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createUserFeedClone, CreateUserFeedCloneInput, CreateUserFeedCloneOutput } from "../api";

export const useCreateUserFeedClone = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedCloneOutput,
    ApiAdapterError,
    CreateUserFeedCloneInput
  >((details) => createUserFeedClone(details), {
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
