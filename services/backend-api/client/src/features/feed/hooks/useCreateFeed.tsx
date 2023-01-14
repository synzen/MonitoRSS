import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createFeed, CreateFeedInput, CreateFeedOutput } from "../api";

export const useCreateFeed = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    CreateFeedOutput,
    ApiAdapterError,
    CreateFeedInput
  >((details) => createFeed(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
