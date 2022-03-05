import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServerChannels, GetServerChannelsOutput } from '../api';

interface Props {
  serverId: string
}

export const useDiscordServerChannels = (
  { serverId }: Props,
) => useQuery<GetServerChannelsOutput, ApiAdapterError>(
  ['server-channels', {
    serverId,
  }],
  async () => getServerChannels({
    serverId,
  }),
);
