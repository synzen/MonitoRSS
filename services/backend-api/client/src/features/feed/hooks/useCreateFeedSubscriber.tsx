import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  createFeedSubscriber,
  CreateFeedSubscriberOutput,
  CreateFeedSubscribersInput,
  GetFeedSubscribersOutput,
} from '../api';

interface Props {
  feedId: string
}

export const useCreateFeedSubscriber = ({ feedId }: Props) => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<CreateFeedSubscriberOutput, ApiAdapterError, CreateFeedSubscribersInput>(
    (details) => createFeedSubscriber(details),
    {
      onSuccess: (data) => {
        const currentData = queryClient.getQueryData<GetFeedSubscribersOutput>(
          ['feed-subscribers', {
            feedId,
          }],
        );

        if (!currentData) {
          return;
        }

        queryClient.setQueryData(
          ['feed-subscribers', {
            feedId,
          }],
          {
            ...currentData,
            results: [
              data.result,
              ...currentData.results,
            ],
          },
        );
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
