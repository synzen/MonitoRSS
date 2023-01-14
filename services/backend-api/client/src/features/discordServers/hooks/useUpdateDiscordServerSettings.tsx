import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  updateServerSettings,
  UpdateServerSettingsInput,
  UpdateServerSettingsOutput,
} from "../api";
import { UseDiscordServerSettingsData } from "./useDiscordServerSettings";

export const useUpdateDiscordServerSettings = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    UpdateServerSettingsOutput,
    ApiAdapterError,
    UpdateServerSettingsInput
  >((details) => updateServerSettings(details), {
    onSuccess: (data, inputData) => {
      queryClient.setQueryData<UseDiscordServerSettingsData>(
        ["server-settings", inputData.serverId],
        {
          profile: data.result.profile,
        }
      );
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
