import { useQuery } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { GetDiscordWebhooksOutput, getDiscordWebhooks } from '../api';

interface Props {
  serverId?: string
}

export const useDiscordWebhooks = ({
  serverId,
}: Props) => {
  const { data, status, error } = useQuery<
  GetDiscordWebhooksOutput, ApiAdapterError
  >(
    ['discord-server-webhooks', {
      serverId,
    }],
    async () => {
      if (!serverId) {
        throw new Error('Missing server selection when getting server webhooks');
      }

      return getDiscordWebhooks({
        serverId,
      });
    },
    {
      enabled: !!serverId,
    },
  );

  return {
    data: data?.results,
    status,
    error,
  };
};
