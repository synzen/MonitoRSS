import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  CreateUserFeedLegacyRestoreInput,
  CreateUserFeedLegacyRestoreOutput,
  createUserFeedLegacyRestore,
} from "../api/createUserFeedLegacyRestore";

export const useCreateUserFeedLegacyRestore = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateUserFeedLegacyRestoreOutput,
    ApiAdapterError,
    CreateUserFeedLegacyRestoreInput
  >((details) => createUserFeedLegacyRestore(details), {
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === "user-feeds" ||
            query.queryKey[0] === "feeds" ||
            query.queryKey[0] === "server-legacy-feed-bulk-conversion" ||
            query.queryKey[0] === "feed" ||
            query.queryKey[0] === "legacy-feed-count" ||
            query.queryKey[0] === "discord-user-me"
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
