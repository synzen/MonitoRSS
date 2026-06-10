import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createUserFeedUrlValidation,
  CreateUserFeedUrlValidationInput,
  CreateUserFeedUrlValidationOutput,
} from "../api/createUserFeedUrlValidation";
import { useFeedScope } from "../contexts/FeedScopeContext";

export const useCreateUserFeedUrlValidation = () => {
  const { workspaceId } = useFeedScope();

  const { mutateAsync, status, error, reset, data } = useMutation<
    CreateUserFeedUrlValidationOutput,
    ApiAdapterError,
    CreateUserFeedUrlValidationInput
  >(
    // In workspace scope, validation (and its reddit gate) runs against the workspace.
    (input) =>
      createUserFeedUrlValidation({
        details: { ...input.details, workspaceId: input.details.workspaceId ?? workspaceId },
      }),
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
    data,
  };
};
