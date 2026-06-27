import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createUserFeed, CreateUserFeedInput, CreateUserFeedOutput } from "../api";
import { useFeedScope } from "../contexts/FeedScopeContext";

export const useCreateUserFeed = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useFeedScope();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedOutput,
    ApiAdapterError,
    CreateUserFeedInput
  >(
    // In workspace scope, new feeds are created under the workspace.
    (input) =>
      createUserFeed({
        details: { ...input.details, workspaceId: input.details.workspaceId ?? workspaceId },
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["user-feeds"],
          exact: false,
        });
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
