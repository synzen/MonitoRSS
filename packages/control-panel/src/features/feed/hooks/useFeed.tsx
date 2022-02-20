import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getFeed, GetFeedOutput } from '../api';

interface Props {
  feedId?: string
}

export const useFeed = ({ feedId }: Props) => {
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
