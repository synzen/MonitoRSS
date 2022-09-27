import { useMutation } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  createDiscordChannelConnection,
  CreateDiscordChannelConnectionInput,
  CreateDiscordChannelConnectionOutput,
} from '../api';

export const useCreateDiscordChannelConnection = () => {
  const {
    mutateAsync,
    status,
    error,
    reset,
  } = useMutation<
  CreateDiscordChannelConnectionOutput,
  ApiAdapterError,
  CreateDiscordChannelConnectionInput
  >(
    (details) => createDiscordChannelConnection(details),
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
