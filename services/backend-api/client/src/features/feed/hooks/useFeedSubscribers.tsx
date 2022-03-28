import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getFeedSubscribers, GetFeedSubscribersOutput } from '../api';

interface Props {
  feedId?: string
}

export const useFeedSubscribers = ({ feedId }: Props) => {
  const {
    data, status, error, refetch,
  } = useQuery<GetFeedSubscribersOutput, ApiAdapterError | Error>(
    ['feed-subscribers', {
      feedId,
    }],
    async () => {
      if (!feedId) {
        throw new Error('Missing feed selection when getting subscribers');
      }

      return getFeedSubscribers({
        feedId,
      });
    },
    {
      enabled: !!feedId,
    },
  );

  return {
    data,
    status,
    error,
    refetch,
  };
};
