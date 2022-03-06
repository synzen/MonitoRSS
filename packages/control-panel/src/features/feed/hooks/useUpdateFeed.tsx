import { useMutation, useQueryClient } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { updateFeed, UpdateFeedInput, UpdateFeedOutput } from '../api';

interface Props {
  feedId: string
}

export const useUpdateFeed = ({ feedId }: Props) => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<UpdateFeedOutput, ApiAdapterError, UpdateFeedInput>(
    (details) => updateFeed(details),
    {
      onSuccess: (data) => {
        queryClient.setQueryData(['feed', {
          feedId,
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
