import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getServers, { GetServersOutput } from '../adapters/servers/getServer';

const useDiscordServers = () => useQuery<GetServersOutput, ApiAdapterError>(
  'servers',
  async () => getServers(),
);

export default useDiscordServers;
