import { useQuery } from 'react-query';
import { useState } from 'react';
import { DiscordServer } from '../types/DiscordServer';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServers } from '../api';

interface Props {
  serverId?: string
}

export const useDiscordServer = ({ serverId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const { data, error, status } = useQuery<DiscordServer | null, ApiAdapterError>(
    ['server', serverId],
    async () => {
      if (!serverId) {
        throw new Error('Server ID is required when fetching discord server');
      }

      const servers = await getServers();

      return servers.results.find((server) => server.id === serverId) || null;
    },
    {
      enabled: !!serverId && !hasErrored,
      onError: () => setHasErrored(true),
    },
  );

  return {
    data,
    error,
    status,
  };
};
