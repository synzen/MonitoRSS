import { useQuery } from '@tanstack/react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import {
  GetUserFeedRequestsInput,
  GetUserFeedRequestsOutput,
  getUserFeedRequests,
} from '../api';

interface Props {
  feedId?: string
  data: GetUserFeedRequestsInput['data']
}

export const useUserFeedRequests = ({ feedId, data: inputData }: Props) => {
  const queryKey = ['user-feed-requests', {
    feedId,
    data: inputData,
  }];

  const {
    data, status, error, fetchStatus,
  } = useQuery<
  GetUserFeedRequestsOutput,
  ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error('Feed ID is required to fetch feed articles');
      }

      return getUserFeedRequests({
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
    fetchStatus,
  };
};
