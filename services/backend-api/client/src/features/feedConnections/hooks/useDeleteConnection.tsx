import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedConnectionType } from "../../../types";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { deleteDiscordChannelConnection } from "../api";

interface DeleteConnectionInput {
  feedId: string;
  connectionId: string;
}

const methodsByType: Record<FeedConnectionType, (input: DeleteConnectionInput) => Promise<void>> = {
  [FeedConnectionType.DiscordChannel]: deleteDiscordChannelConnection,
};

export const useDeleteConnection = (type: FeedConnectionType) => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiAdapterError, DeleteConnectionInput>(
    (details) => {
      const method = methodsByType[type];

      return method(details);
    },
    {
      onSuccess: (data, inputData) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "user-feed",
              {
                feedId: inputData.feedId,
              },
            ],
            refetchType: "all",
          }),
          queryClient.invalidateQueries({
            queryKey: ["user-feeds"],
            refetchType: "all",
          }),
        ]),
    }
  );
};
