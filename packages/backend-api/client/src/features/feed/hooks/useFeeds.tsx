import { useQuery, useQueryClient } from 'react-query';
import { useState } from 'react';
import { pick } from 'lodash';
import { getFeeds, GetFeedsOutput } from '../api';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { useDiscordServerAccessStatus } from '@/features/discordServers';
import { FeedSummary } from '../types';

interface Props {
  serverId?: string
  initialLimit?: number
}

export const useFeeds = ({ serverId, initialLimit }: Props) => {
  const [limit, setLimit] = useState(initialLimit || 10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [hasErrored, setHasErrored] = useState(false);
  const { data: accessData } = useDiscordServerAccessStatus({ serverId });
  const queryClient = useQueryClient();

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
    refetch,
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

      return result;
    },
    {
      enabled: !!accessData?.result.authorized && !hasErrored,
      keepPreviousData: true,
      onError: () => {
        setHasErrored(true);
      },
    },
  );

  const isFetchingNewPage = isLoading || (isFetching && isPreviousData);

  const updateCachedFeed = (feedId: string, details: Partial<FeedSummary>) => {
    const existingFeed = data?.results.find((feed) => feed.id === feedId);

    if (!data || !existingFeed) {
      return;
    }

    const updatedFeeds = data.results.map((feed) => {
      if (feed.id === feedId) {
        const updatedFields = pick(details, Object.keys(feed));

        return {
          ...feed,
          ...updatedFields,
        };
      }

      return feed;
    });

    queryClient.setQueryData<GetFeedsOutput>(queryKey, {
      results: updatedFeeds,
      total: data.total,
    });
  };

  return {
    data,
    status,
    error,
    setLimit,
    setOffset,
    setSearch,
    isFetchingNewPage,
    isFetching,
    refetch,
    search: search || '',
    updateCachedFeed,
  };
};
