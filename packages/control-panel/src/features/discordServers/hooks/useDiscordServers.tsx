import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { GetServersOutput, getServers } from '../api';

export const useDiscordServers = () => useQuery<GetServersOutput, ApiAdapterError>(
  'servers',
  async () => getServers(),
);
