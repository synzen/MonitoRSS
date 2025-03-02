import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createUserFeedDeduplicatedUrls,
  CreateUserFeedDeduplicatedUrlsInput,
  CreateUserFeedDeduplicatedUrlsOutput,
} from "../api/createUserFeedDeduplicatedUrls";

export const useCreateUserFeedDeduplicatedUrls = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedDeduplicatedUrlsOutput,
    ApiAdapterError,
    CreateUserFeedDeduplicatedUrlsInput
  >((details) => createUserFeedDeduplicatedUrls(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
