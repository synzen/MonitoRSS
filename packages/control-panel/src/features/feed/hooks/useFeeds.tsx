import { useQuery } from 'react-query';
import { useEffect, useState } from 'react';
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
  const [loadingNewServer, setLoadingNewServer] = useState(false);

  useEffect(() => {
    setLoadingNewServer(true);
  }, [serverId]);

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

      const result = await getFeeds({
        serverId,
        limit,
        offset,
        search,
      });

      setLoadingNewServer(false);

      return result;
    },
    {
      enabled: !!serverId,
      keepPreviousData: true,
    },
  );

  const isFetchingNewPage = isLoading || (isFetching && isPreviousData);
  const isFetchingDifferentServer = isFetching && loadingNewServer;

  return {
    data,
    status,
    error,
    setLimit,
    setOffset,
    setSearch,
    isFetchingNewPage,
    isFetchingDifferentServer,
  };
};
