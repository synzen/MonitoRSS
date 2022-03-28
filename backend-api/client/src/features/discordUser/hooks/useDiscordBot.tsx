import { useQuery } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { getDiscordBot, GetDiscordBotOutput } from '../api';

export const useDiscordBot = () => {
  const { data, status, error } = useQuery<
  GetDiscordBotOutput, ApiAdapterError
  >(
    ['discord-bot'],
    async () => getDiscordBot(),
  );

  return {
    data,
    status,
    error,
  };
};
