import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetUserFeedOutput,
  updateUserFeed,
  UpdateUserFeedInput,
  UpdateUserFeedOutput,
} from "../api";

export const useUpdateUserFeed = () => {
  const queryClient = useQueryClient();

  return useMutation<UpdateUserFeedOutput, ApiAdapterError, UpdateUserFeedInput>(
    (details) => updateUserFeed(details),
    {
      onSuccess: (data, inputData) => {
        queryClient.setQueryData<GetUserFeedOutput>(
          [
            "user-feed",
            {
              feedId: inputData.feedId,
            },
          ],
          data
        );

        return queryClient.invalidateQueries({
          predicate: (query) => {
            return query.queryKey[0] === "user-feeds";
          },
        });
      },
    }
  );
};
