import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createUserFeedUrlValidation,
  CreateUserFeedUrlValidationInput,
  CreateUserFeedUrlValidationOutput,
} from "../api/createUserFeedUrlValidation";

export const useCreateUserFeedUrlValidation = () => {
  const { mutateAsync, status, error, reset, data } = useMutation<
    CreateUserFeedUrlValidationOutput,
    ApiAdapterError,
    CreateUserFeedUrlValidationInput
  >((details) => createUserFeedUrlValidation(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
    data,
  };
};
