import { useState } from 'react';
import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServerChannels, GetServerChannelsOutput } from '../api';

interface Props {
  serverId?: string
}

export const useDiscordServerChannels = (
  { serverId }: Props,
) => {
  const [hadError, setHadError] = useState(false);
  const queryKey = ['server-channels', {
    serverId,
  }];

  const {
    data, status, error, isLoading,
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
      enabled: !!serverId && !hadError,
      onError: () => setHadError(true),
    },
  );

  console.log('channel is loading', isLoading);

  return {
    data,
    status,
    error,
  };
};
