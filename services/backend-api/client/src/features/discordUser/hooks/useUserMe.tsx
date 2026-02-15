import { useQuery } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
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
    ["user-me"],
    async () => getUserMe(),
    {
      refetchInterval: (fetchedResult) => {
        if (checkForSubscriptionCreated) {
          if (fetchedResult?.result.subscription.product.key === ProductKey.Free) {
            // Keep checking until it's not free
            return 1000;
          }

          return false;
        }

        return false;
      },
      enabled: props?.enabled,
    },
  );

  useEffect(() => {
    if (data?.result.id) {
      Sentry.setUser({
        id: data.result.id,
        email: data.result.email,
      });
    }
  }, [data?.result.id]);

  return {
    data,
    error,
    status,
    fetchStatus,
    refetch,
  };
};
