import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getUserMe, GetUserMeInput, GetUserMeOutput } from "../api";
import { ProductKey } from "../../../constants";

interface Props {
  checkForSubscriptionUpdateAfter?: Date;
  checkForSubscriptionCreated?: boolean;
  input?: GetUserMeInput;
}

export const useUserMe = (props?: Props) => {
  const checkForSubscriptionUpdateAfter = props?.checkForSubscriptionUpdateAfter;
  const checkForSubscriptionCreated = props?.checkForSubscriptionCreated;
  const input = props?.input;

  const { refetch, data, error, status, fetchStatus } = useQuery<GetUserMeOutput, ApiAdapterError>(
    [
      "user-me",
      {
        input,
      },
    ],
    async () => getUserMe(input),
    {
      refetchInterval: (fetchedResult) => {
        if (checkForSubscriptionUpdateAfter) {
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
        }

        if (checkForSubscriptionCreated) {
          if (fetchedResult?.result.subscription.product.key === ProductKey.Free) {
            // Keep checking until it's not free
            return 1000;
          }

          return false;
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
    refetch,
  };
};
