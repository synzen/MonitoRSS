import { useMutation, useQueryClient } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  updateServerSettings,
  UpdateServerSettingsInput,
  UpdateServerSettingsOutput,
} from '../api';

export const useUpdateDiscordServerSettings = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<UpdateServerSettingsOutput, ApiAdapterError, UpdateServerSettingsInput>(
    (details) => updateServerSettings(details),
    {
      onSuccess: (data, inputData) => {
        queryClient.setQueryData(['server-settings', {
          serverId: inputData.serverId,
        }], data);
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
