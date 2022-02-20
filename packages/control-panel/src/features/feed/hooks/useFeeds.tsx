import { useQuery } from 'react-query';
import { getFeeds, GetFeedsOutput } from '../api';
import ApiAdapterError from '../../../utils/ApiAdapterError';

interface Props {
  serverId: string
}

export const useFeeds = ({ serverId }: Props) => useQuery<GetFeedsOutput, ApiAdapterError>(
  ['feeds', { serverId }],
  async () => getFeeds({
    serverId,
  }),
);
