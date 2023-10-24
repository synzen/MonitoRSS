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
}

export const useUpdateConnection = ({ type }: Props) => {
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
      ]),
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
