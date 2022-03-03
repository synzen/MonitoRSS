import { useQuery } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { getDiscordServerWebhooks, GetDiscordServerWebhooksOutput } from '../api';

interface Props {
  serverId: string
}

export const useDiscordServerWebhooks = ({
  serverId,
}: Props) => useQuery<
GetDiscordServerWebhooksOutput, ApiAdapterError
>(
  ['discord-server-webhooks', {
    serverId,
  }],
  async () => {
    if (!serverId) {
      throw new Error('Missing server selection when getting server webhooks');
    }

    return getDiscordServerWebhooks({
      serverId,
    });
  },
  {
    enabled: !!serverId,
  },
);
