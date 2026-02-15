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
  >(
    async (details) => {
      if (!details.details.targetDiscordChannelConnectionIds.length) {
        throw new Error("Must select at least one target connection");
      }

      await createDiscordChannelConnectionCopySettings(details);
    },
    {
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
    },
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
