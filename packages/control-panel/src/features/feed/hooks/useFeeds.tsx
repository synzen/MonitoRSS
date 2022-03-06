import { useQuery } from 'react-query';
import { useState } from 'react';
import { getFeeds, GetFeedsOutput } from '../api';
import ApiAdapterError from '../../../utils/ApiAdapterError';

interface Props {
  serverId?: string
  initialLimit?: number
}

export const useFeeds = ({ serverId, initialLimit }: Props) => {
  const [limit, setLimit] = useState(initialLimit || 10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  const queryKey = ['feeds', {
    serverId,
    limit,
    offset,
    search: search || '',
  }];

  const {
    data,
    status,
    error,
    isFetching,
    isPreviousData,
    isLoading,
  } = useQuery<GetFeedsOutput, ApiAdapterError>(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error('Missing server ID when getting feeds');
      }

      return getFeeds({
        serverId,
        limit,
        offset,
        search,
      });
    },
    {
      enabled: !!serverId,
      keepPreviousData: true,
    },
  );

  const isFetchingNewContent = isLoading || (isFetching && isPreviousData);

  return {
    data,
    status,
    error,
    setLimit,
    setOffset,
    setSearch,
    isFetchingNewContent,
  };
};
