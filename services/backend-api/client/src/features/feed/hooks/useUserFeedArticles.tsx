import { useQuery } from '@tanstack/react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import {
  getUserFeedArticles,
  GetUserFeedArticlesInput,
  GetUserFeedArticlesOutput,
} from '../api';

interface Props {
  feedId?: string
  data: GetUserFeedArticlesInput['data']
}

export const useUserFeedArticles = ({ feedId, data: inputData }: Props) => {
  const queryKey = ['user-feed-articles', {
    feedId,
  }];

  const {
    data, status, error, refetch, fetchStatus,
  } = useQuery<GetUserFeedArticlesOutput, ApiAdapterError | Error, GetUserFeedArticlesOutput>(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error('Feed ID is required to fetch feed articles');
      }

      return getUserFeedArticles({
        feedId,
        data: inputData,
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
    fetchStatus,
  };
};
