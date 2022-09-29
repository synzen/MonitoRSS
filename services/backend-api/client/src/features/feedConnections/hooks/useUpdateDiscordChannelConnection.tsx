import { useMutation } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  updateDiscordChannelConnection,
  UpdateDiscordChannelConnectionInput,
  UpdateDiscordChannelConnectionOutput,
} from '../api';

export const useUpdateDiscordChannelConnection = () => {
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
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
