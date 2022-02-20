import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeed, { GetFeedOutput } from '../adapters/feeds/getFeed';

interface Props {
  serverId?: string
  feedId?: string
}

const useFeed = ({ serverId, feedId }: Props) => useQuery<GetFeedOutput, ApiAdapterError | Error>(
  ['feed', {
    serverId,
    feedId,
  }],
  async () => {
    if (!serverId || !feedId) {
      throw new Error('Missing server or feed selection');
    }

    return getFeed({
      serverId,
      feedId,
    });
  },
  {
    enabled: !!serverId && !!feedId,
  },
);

export default useFeed;
