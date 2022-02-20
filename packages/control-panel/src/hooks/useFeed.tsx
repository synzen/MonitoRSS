import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeed, { GetFeedOutput } from '../adapters/feeds/getFeed';

interface Props {
  serverId: string
  feedId: string
}

const useFeed = ({ serverId, feedId }: Props) => useQuery<GetFeedOutput, ApiAdapterError>(
  ['feed', {
    serverId,
    feedId,
  }],
  async () => getFeed({
    serverId,
    feedId,
  }),
);

export default useFeed;
