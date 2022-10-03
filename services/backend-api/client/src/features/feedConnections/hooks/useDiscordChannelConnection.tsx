import { useState } from 'react';
import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getDiscordChannelConnection, GetDiscordChannelConnectionOutput } from '../api';

interface Props {
  feedId?: string
  connectionId?: string
}

export const useDiscordChannelConnection = ({ feedId, connectionId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const { data, status, error } = useQuery<
  GetDiscordChannelConnectionOutput, ApiAdapterError | Error
  >(
    ['connections-discord-channel', {
      feedId,
    }],
    async () => {
      if (!feedId || !connectionId) {
        throw new Error('Missing feed or connection ID selection');
      }

      return getDiscordChannelConnection({
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
