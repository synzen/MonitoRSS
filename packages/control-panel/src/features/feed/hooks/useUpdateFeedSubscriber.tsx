import { useMutation, useQueryClient } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  GetFeedSubscribersOutput,
  updateFeedSubscriber,
  UpdateFeedSubscriberInput,
  UpdateFeedSubscriberOutput,
} from '../api';

export const useUpdateFeedSubscriber = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<
  UpdateFeedSubscriberOutput,
  ApiAdapterError,
  UpdateFeedSubscriberInput>(
    (details) => updateFeedSubscriber(details),
    {
      onSuccess: (data) => {
        const currentSubscribersData = queryClient.getQueryData<GetFeedSubscribersOutput>(
          ['feed-subscribers', {
            feedId: data.result.feed,
          }],
        );

        if (currentSubscribersData) {
          const updatedState = currentSubscribersData.results.map((sub) => {
            if (sub.id === data.result.id) {
              return data.result;
            }
          });

          queryClient.setQueryData(['feed-subscribers', {
            feedId: data.result.feed,
          }], updatedState);
        }
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
