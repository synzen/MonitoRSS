import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getUserMe, GetUserMeOutput } from "../api";
import { ProductKey } from "../../../constants";

interface Props {
  checkForSubscriptionCreated?: boolean;
  enabled?: boolean;
}

export const useUserMe = (props?: Props) => {
  const checkForSubscriptionCreated = props?.checkForSubscriptionCreated;

  const { refetch, data, error, status, fetchStatus } = useQuery<GetUserMeOutput, ApiAdapterError>(
    {
      queryKey: ["user-me"],
      queryFn: async () => getUserMe(),
      refetchInterval: (query) => {
        if (checkForSubscriptionCreated) {
          if (query.state.data?.result.subscription.product.key === ProductKey.Free) {
            return 1000;
          }

          return false;
        }

        return false;
      },
      enabled: props?.enabled,
    },
  );

  return {
    data,
    error,
    status,
    fetchStatus,
    refetch,
  };
};
