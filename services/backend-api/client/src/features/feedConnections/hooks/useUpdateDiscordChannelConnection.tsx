import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  updateDiscordChannelConnection,
  UpdateDiscordChannelConnectionInput,
  UpdateDiscordChannelConnectionOutput,
} from '../api';

export const useUpdateDiscordChannelConnection = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
    reset,
  } = useMutation<
  UpdateDiscordChannelConnectionOutput,
  ApiAdapterError,
  UpdateDiscordChannelConnectionInput
  >(
    (details) => updateDiscordChannelConnection(details),
    {
      onSuccess: (data, inputData) => queryClient.invalidateQueries({
        queryKey: ['user-feed', {
          feedId: inputData.feedId,
        }],
        refetchType: 'all',
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
