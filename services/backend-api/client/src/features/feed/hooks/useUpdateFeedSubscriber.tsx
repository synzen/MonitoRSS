import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetFeedSubscribersOutput,
  updateFeedSubscriber,
  UpdateFeedSubscriberInput,
  UpdateFeedSubscriberOutput,
} from "../api";

export const useUpdateFeedSubscriber = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    UpdateFeedSubscriberOutput,
    ApiAdapterError,
    UpdateFeedSubscriberInput
  >((details) => updateFeedSubscriber(details), {
    onSuccess: (data) => {
      const currentSubscribersData = queryClient.getQueryData<GetFeedSubscribersOutput>([
        "feed-subscribers",
        {
          feedId: data.result.feed,
        },
      ]);

      if (currentSubscribersData) {
        const updatedResults = currentSubscribersData.results.map((sub) => {
          if (sub.id === data.result.id) {
            return data.result;
          }

          return sub;
        });

        queryClient.setQueryData<GetFeedSubscribersOutput>(
          [
            "feed-subscribers",
            {
              feedId: data.result.feed,
            },
          ],
          {
            results: updatedResults,
            total: updatedResults.length,
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
