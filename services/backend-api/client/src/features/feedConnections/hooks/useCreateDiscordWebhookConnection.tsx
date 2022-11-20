import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  createDiscordWebhookConnection,
  CreateDiscordWebhookConnectionInput,
  CreateDiscordWebhookConnectionOutput,
} from '../api';

export const useCreateDiscordWebhookConnection = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
    reset,
  } = useMutation<
  CreateDiscordWebhookConnectionOutput,
  ApiAdapterError,
  CreateDiscordWebhookConnectionInput
  >(
    (details) => createDiscordWebhookConnection(details),
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
