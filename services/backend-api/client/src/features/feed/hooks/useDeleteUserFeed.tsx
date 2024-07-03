import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteUserFeed, DeleteUserFeedInput } from "../api";

export const useDeleteUserFeed = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiAdapterError, DeleteUserFeedInput>(
    (details) => deleteUserFeed(details),
    {
      onSuccess: () => {
        return queryClient.invalidateQueries(
          {
            predicate: (query) => {
              return query.queryKey[0] === "user-feeds" || query.queryKey[0] === "discord-user-me";
            },
            refetchType: "all",
            exact: false,
          },
          {
            throwOnError: true,
          }
        );
      },
    }
  );
};
