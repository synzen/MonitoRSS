import { useMutation, useQueryClient } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { updateUserFeed, UpdateUserFeedInput, UpdateUserFeedOutput } from '../api';

export const useUpdateUserFeed = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<UpdateUserFeedOutput, ApiAdapterError, UpdateUserFeedInput>(
    (details) => updateUserFeed(details),
    {
      onSuccess: (data, inputData) => {
        queryClient.setQueryData(['user-feed', {
          feedId: inputData.feedId,
        }], data);
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
