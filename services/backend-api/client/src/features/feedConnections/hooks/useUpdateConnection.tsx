import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  updateDiscordChannelConnection,
  UpdateDiscordChannelConnectionInput,
  UpdateDiscordChannelConnectionOutput,
} from "../api";
import { FeedConnectionType } from "../../../types";

interface Props {
  type: FeedConnectionType;
  disablePreviewInvalidation?: boolean;
}

export const useUpdateConnection = ({ type, disablePreviewInvalidation }: Props) => {
  const queryClient = useQueryClient();
  const {
    mutateAsync: mutateDiscordChannel,
    status: statusDiscordChannel,
    error: errorDiscordChannel,
    reset: resetDiscordChannel,
  } = useMutation<
    UpdateDiscordChannelConnectionOutput,
    ApiAdapterError,
    UpdateDiscordChannelConnectionInput
  >((details) => updateDiscordChannelConnection(details), {
    onSuccess: async (data, inputData) => {
      const promises: Array<Promise<void>> = [];

      if (inputData.details.customPlaceholders) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === "user-feed-article-properties" &&
              (query.queryKey[1] as Record<string, unknown>)?.feedId === inputData.feedId
            );
          },
        });
      }

      promises.push(
        queryClient.invalidateQueries({
          queryKey: [
            "user-feed",
            {
              feedId: inputData.feedId,
            },
          ],
          refetchType: "all",
        }),
      );

      if (!disablePreviewInvalidation) {
        promises.push(
          queryClient.invalidateQueries({
            queryKey: [
              "connection-preview",
              {
                inputData: {
                  data: {
                    connectionId: inputData.connectionId,
                  },
                },
              },
            ],
            refetchType: "active",
          }),
        );
      }

      await Promise.all(promises);
    },
  });

  if (type === FeedConnectionType.DiscordChannel) {
    return {
      mutateAsync: mutateDiscordChannel,
      status: statusDiscordChannel,
      error: errorDiscordChannel,
      reset: resetDiscordChannel,
    };
  }

  throw new Error(`Unsupported connection type for useUpdateConnection: ${type}`);
};
