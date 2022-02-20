import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeeds, { GetFeedsOutput } from '../adapters/feeds/getFeeds';

interface Props {
  serverId: string
}

const useFeeds = ({ serverId }: Props) => useQuery<GetFeedsOutput, ApiAdapterError>(
  ['feeds', { serverId }],
  async () => getFeeds({
    serverId,
  }),
);

export default useFeeds;
