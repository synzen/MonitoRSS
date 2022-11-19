import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServerChannels, GetServerChannelsOutput } from '../api';
import { useDiscordServerAccessStatus } from './useDiscordServerAccessStatus';

interface Props {
  serverId?: string
}

export const useDiscordServerChannels = (
  { serverId }: Props,
) => {
  const { data: accessData } = useDiscordServerAccessStatus({ serverId });
  const [hadError, setHadError] = useState(false);
  const queryKey = ['server-channels', {
    serverId,
  }];

  const {
    data, status, error,
  } = useQuery<GetServerChannelsOutput, ApiAdapterError>(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error('Missing server ID when getting server channels');
      }

      return getServerChannels({
        serverId,
      });
    },
    {
      enabled: accessData?.result.authorized && !hadError,
      onError: () => setHadError(true),
    },
  );

  return {
    data,
    status,
    error,
  };
};
