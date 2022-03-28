import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { GetServersOutput, getServers } from '../api';

export const useDiscordServers = () => {
  const {
    status, error, data, refetch,
  } = useQuery<GetServersOutput, ApiAdapterError>(
    'servers',
    async () => getServers(),
  );

  return {
    status,
    error,
    data,
    refetch,
  };
};
