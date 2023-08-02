import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createDiscordWebhookConnectionClone,
  CreateDiscordWebhookConnectionCloneInput,
  CreateDiscordWebhookConnectionCloneOutput,
} from "../api";

export const useCreateDiscordWebhookConnectionClone = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    CreateDiscordWebhookConnectionCloneOutput,
    ApiAdapterError,
    CreateDiscordWebhookConnectionCloneInput
  >((details) => createDiscordWebhookConnectionClone(details), {
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
