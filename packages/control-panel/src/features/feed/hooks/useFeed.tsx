import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getFeed, GetFeedOutput } from '../api';

interface Props {
  feedId?: string
}

export const useFeed = ({ feedId }: Props) => {
  const queryKey = ['feed', {
    feedId,
  }];

  const {
    data, status, error, refetch,
  } = useQuery<GetFeedOutput, ApiAdapterError | Error>(
    queryKey,
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
    refetch,
  };
};
