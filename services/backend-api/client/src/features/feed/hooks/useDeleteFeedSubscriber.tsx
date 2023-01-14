import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteFeedSubscriber, DeleteFeedSubscriberInput, GetFeedSubscribersOutput } from "../api";

export const useDeleteFeedSubscriber = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    any,
    ApiAdapterError,
    DeleteFeedSubscriberInput
  >((details) => deleteFeedSubscriber(details), {
    onSuccess: (data, { subscriberId, feedId }) => {
      const currentSubscribersData = queryClient.getQueryData<GetFeedSubscribersOutput>([
        "feed-subscribers",
        {
          feedId,
        },
      ]);

      if (currentSubscribersData) {
        const updatedState = currentSubscribersData.results.filter(
          (sub) => sub.id !== subscriberId
        );

        queryClient.setQueryData<GetFeedSubscribersOutput>(
          [
            "feed-subscribers",
            {
              feedId,
            },
          ],
          {
            results: updatedState,
            total: updatedState.length,
          }
        );
      }
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
