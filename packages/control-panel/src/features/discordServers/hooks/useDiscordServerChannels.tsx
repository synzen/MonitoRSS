import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServerChannels, GetServerChannelsOutput } from '../api';

interface Props {
  serverId?: string
}

export const useDiscordServerChannels = (
  { serverId }: Props,
) => {
  const { data, status, error } = useQuery<GetServerChannelsOutput, ApiAdapterError>(
    ['server-channels', {
      serverId,
    }],
    async () => {
      if (!serverId) {
        throw new Error('Missing server ID when getting server channels');
      }

      return getServerChannels({
        serverId,
      });
    },
    {
      enabled: !!serverId,
    },
  );

  return {
    data,
    status,
    error,
  };
};
