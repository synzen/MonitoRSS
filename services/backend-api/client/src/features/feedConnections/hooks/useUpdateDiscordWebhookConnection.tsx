import { useMutation } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  updateDiscordWebhookConnection,
  UpdateDiscordWebhookConnectionInput,
  UpdateDiscordWebhookConnectionOutput,
} from '../api';

export const useUpdateDiscordWebhookConnection = () => {
  const {
    mutateAsync,
    status,
    error,
    reset,
  } = useMutation<
  UpdateDiscordWebhookConnectionOutput,
  ApiAdapterError,
  UpdateDiscordWebhookConnectionInput
  >(
    (details) => updateDiscordWebhookConnection(details),
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
