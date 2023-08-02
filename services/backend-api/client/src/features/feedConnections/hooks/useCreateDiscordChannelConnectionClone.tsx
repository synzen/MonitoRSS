import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createDiscordChannelConnectionClone,
  CreateDiscordChannelConnectionCloneInput,
  CreateDiscordChannelConnectionCloneOutput,
} from "../api";

export const useCreateDiscordChannelConnectionClone = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    CreateDiscordChannelConnectionCloneOutput,
    ApiAdapterError,
    CreateDiscordChannelConnectionCloneInput
  >((details) => createDiscordChannelConnectionClone(details), {
    onSuccess: (data, inputData) =>
      queryClient.invalidateQueries({
        queryKey: [
          "user-feed",
          {
            feedId: inputData.feedId,
          },
        ],
      }),
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
