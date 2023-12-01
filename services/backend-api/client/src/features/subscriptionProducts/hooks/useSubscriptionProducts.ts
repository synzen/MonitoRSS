import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetSubscriptionProductsInput,
  GetSubscriptionProductsOutput,
  getSubscriptionProducts,
} from "../api";

export const useSubscriptionProducts = (input?: GetSubscriptionProductsInput) => {
  const { data, status, error, fetchStatus } = useQuery<
    GetSubscriptionProductsOutput,
    ApiAdapterError
  >(
    [
      "subscription-products",
      {
        input,
      },
    ],
    async () => getSubscriptionProducts(input || {}),
    {
      keepPreviousData: true,
    }
  );

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
