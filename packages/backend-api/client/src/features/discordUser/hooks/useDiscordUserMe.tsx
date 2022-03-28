import { useQuery } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { getDiscordMe, GetDiscordMeOutput } from '../api';

export const useDiscordUserMe = () => {
  const { data, status, error } = useQuery<
  GetDiscordMeOutput, ApiAdapterError
  >(
    ['discord-user-me'],
    async () => getDiscordMe(),
  );

  return {
    data,
    status,
    error,
  };
};
