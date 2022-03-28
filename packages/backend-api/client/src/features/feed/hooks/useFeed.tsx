import { useQuery, useQueryClient } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getFeed, GetFeedOutput } from '../api';
import { Feed } from '../types';

interface Props {
  feedId?: string
}

export const useFeed = ({ feedId }: Props) => {
  const queryClient = useQueryClient();
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

  const updateCache = (details: Partial<Feed>) => {
    if (!data) {
      return;
    }

    queryClient.setQueryData<GetFeedOutput>(queryKey, {
      result: {
        ...data.result,
        ...details,
      },
    });
  };

  return {
    feed: data?.result,
    status,
    error,
    refetch,
    updateCache,
  };
};
