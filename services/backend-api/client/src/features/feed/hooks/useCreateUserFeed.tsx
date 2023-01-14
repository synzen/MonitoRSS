import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createUserFeed, CreateUserFeedInput, CreateUserFeedOutput } from "../api";

export const useCreateUserFeed = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedOutput,
    ApiAdapterError,
    CreateUserFeedInput
  >((details) => createUserFeed(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
