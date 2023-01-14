import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createDiscordChannelConnection,
  CreateDiscordChannelConnectionInput,
  CreateDiscordChannelConnectionOutput,
} from "../api";

export const useCreateDiscordChannelConnection = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    CreateDiscordChannelConnectionOutput,
    ApiAdapterError,
    CreateDiscordChannelConnectionInput
  >((details) => createDiscordChannelConnection(details), {
    onSuccess: (data, inputData) =>
      queryClient.invalidateQueries({
        queryKey: [
          "user-feed",
          {
            feedId: inputData.feedId,
          },
        ],
        refetchType: "all",
      }),
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
