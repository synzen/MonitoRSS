import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  GetUserFeedOutput,
  GetUserFeedsOutput,
  refreshUserFeed,
  RefreshUserFeedInput, RefreshUserFeedOutput,
} from '../api';

export const useRefreshUserFeed = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<RefreshUserFeedOutput, ApiAdapterError, RefreshUserFeedInput>(
    (details) => refreshUserFeed(details),
    {
      onSuccess: (data, inputData) => {
        queryClient.setQueryData<GetUserFeedOutput>(['user-feed', {
          feedId: inputData.feedId,
        }], data);

        queryClient.setQueriesData<GetUserFeedsOutput>(['user-feeds'], (currentFeeds) => {
          if (!currentFeeds) {
            return currentFeeds;
          }

          return {
            ...currentFeeds,
            results: currentFeeds.results.map((feed) => {
              if (feed.id === inputData.feedId) {
                return {
                  ...feed,
                  healthStatus: data.result.healthStatus,
                  disabledCode: data.result.disabledCode,
                };
              }

              return feed;
            }),
          };
        });
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
