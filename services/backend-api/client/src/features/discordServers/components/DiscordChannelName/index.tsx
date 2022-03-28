/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo } from 'react';
import { Text, Tooltip } from '@chakra-ui/react';
import { Loading } from '@/components';
import { useDiscordServerChannels } from '../../hooks';

interface Props {
  serverId?: string
  channelId: string
}

export const DiscordChannelName: React.FC<Props> = ({
  serverId,
  channelId,
}) => {
  const { data, status, error } = useDiscordServerChannels({ serverId });
  const channelNamesById = useMemo(() => {
    const map = new Map<string, string>();

    if (data?.results) {
      data.results.forEach((channel) => {
        map.set(channel.id, channel.name);
      });
    }

    return map;
  }, [data]);

  if (status === 'loading' || status === 'idle') {
    return <Loading size="sm" />;
  }

  if (error) {
    return (
      <Tooltip
        placement="bottom-start"
        label={`Unable to get channel name (${error?.message})`}
      >
        <Text color="orange.500">
          {channelId}
        </Text>
      </Tooltip>
    );
  }

  const channelName = channelNamesById.get(channelId) || channelId;

  return <>{`#${channelName}`}</>;
};
