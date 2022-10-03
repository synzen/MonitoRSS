import { useState } from 'react';
import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getDiscordWebhookConnection, GetDiscordWebhookConnectionOutput } from '../api';

interface Props {
  feedId?: string
  connectionId?: string
}

export const useDiscordWebhookConnection = ({ feedId, connectionId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const { data, status, error } = useQuery<
  GetDiscordWebhookConnectionOutput, ApiAdapterError | Error
  >(
    ['connections-discord-webhook', {
      feedId,
      connectionId,
    }],
    async () => {
      if (!feedId || !connectionId) {
        throw new Error('Missing feed or connection ID selection');
      }

      return getDiscordWebhookConnection({
        feedId,
        connectionId,
      });
    },
    {
      enabled: !!feedId && !!connectionId && !hasErrored,
      onError: () => {
        setHasErrored(true);
      },
    },
  );

  return {
    connection: data?.result,
    status,
    error,
  };
};
