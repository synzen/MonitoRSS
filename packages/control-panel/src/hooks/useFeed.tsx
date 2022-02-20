import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeed, { GetFeedOutput } from '../adapters/feeds/getFeed';

interface Props {
  feedId?: string
}

const useFeed = ({ feedId }: Props) => {
  const { data, status, error } = useQuery<GetFeedOutput, ApiAdapterError | Error>(
    ['feed', {
      feedId,
    }],
    async () => {
      if (!feedId) {
        throw new Error('Missing feed selection');
      }

      return getFeed({
        feedId,
      });
    },
    {
      enabled: !!feedId,
    },
  );

  return {
    feed: data?.result,
    status,
    error,
  };
};

export default useFeed;
