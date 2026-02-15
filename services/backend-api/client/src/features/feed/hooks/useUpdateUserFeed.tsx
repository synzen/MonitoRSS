import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetUserFeedOutput,
  updateUserFeed,
  UpdateUserFeedInput,
  UpdateUserFeedOutput,
} from "../api";

interface Props {
  queryKeyStringsToIgnoreValidation?: string[];
}

export const useUpdateUserFeed = (props?: Props) => {
  const queryClient = useQueryClient();

  return useMutation<UpdateUserFeedOutput, ApiAdapterError, UpdateUserFeedInput>(
    (details) => updateUserFeed(details),
    {
      onSuccess: async (data, inputData) => {
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKeyStringsToIgnoreValidation = new Set(
              props?.queryKeyStringsToIgnoreValidation,
            );

            if (
              queryKeyStringsToIgnoreValidation &&
              query.queryKey.some(
                (item) => typeof item === "string" && queryKeyStringsToIgnoreValidation.has(item),
              )
            ) {
              return false;
            }

            return query.queryKey[0] === "user-feeds" || query.queryKey.includes(inputData.feedId);
          },
        });

        queryClient.setQueryData<GetUserFeedOutput>(
          [
            "user-feed",
            {
              feedId: inputData.feedId,
            },
          ],
          data,
        );
      },
    },
  );
};
