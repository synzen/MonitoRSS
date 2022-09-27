import { useMutation } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  createDiscordWebhookConnection,
  CreateDiscordWebhookConnectionInput,
  CreateDiscordWebhookConnectionOutput,
} from '../api';

export const useCreateDiscordWebhookConnection = () => {
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
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
