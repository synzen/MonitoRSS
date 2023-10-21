import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createDiscordChannelConnectionCopySettings,
  CreateDiscordChannelConnectionCopySettingsInput,
} from "../api";

export const useCreateDiscordChannelConnectionCopySettings = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    CreateDiscordChannelConnectionCopySettingsInput
  >((details) => createDiscordChannelConnectionCopySettings(details), {
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
