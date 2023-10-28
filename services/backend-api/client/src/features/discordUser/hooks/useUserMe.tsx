import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getUserMe, GetUserMeOutput } from "../api";

interface Props {
  checkForSubscriptionUpdateAfter?: Date;
}

export const useUserMe = (props?: Props) => {
  const checkForSubscriptionUpdateAfter = props?.checkForSubscriptionUpdateAfter;
  const { data, error, status, fetchStatus } = useQuery<GetUserMeOutput, ApiAdapterError>(
    ["user-me"],
    async () => getUserMe(),
    {
      refetchInterval: (fetchedResult) => {
        if (!checkForSubscriptionUpdateAfter) {
          return false;
        }

        const subscriptionLastUpdated = fetchedResult?.result.subscription.updatedAt;

        if (!subscriptionLastUpdated) {
          return false;
        }

        if (
          new Date(subscriptionLastUpdated).getTime() < checkForSubscriptionUpdateAfter.getTime()
        ) {
          return 1000;
        }

        return false;
      },
    }
  );

  return {
    data,
    error,
    status,
    fetchStatus,
  };
};
