import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  updateDiscordWebhookConnection,
  UpdateDiscordWebhookConnectionInput,
  UpdateDiscordWebhookConnectionOutput,
} from "../api";

export const useUpdateDiscordWebhookConnection = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    UpdateDiscordWebhookConnectionOutput,
    ApiAdapterError,
    UpdateDiscordWebhookConnectionInput
  >((details) => updateDiscordWebhookConnection(details), {
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
