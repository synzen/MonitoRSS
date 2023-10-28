import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  GetSubscriptionChangePreviewInput,
  GetSubscriptionChangePreviewOutput,
  getSubscriptionChangePreview,
} from "../api";

export const useSubscriptionChangePreview = (input: Partial<GetSubscriptionChangePreviewInput>) => {
  const { data, status, error, fetchStatus } = useQuery<
    GetSubscriptionChangePreviewOutput,
    ApiAdapterError
  >(
    [
      "subscription-change-preview",
      {
        input,
      },
    ],
    async () => {
      if (!input.data) {
        throw new Error("Missing data when fetching subscription change preview");
      }

      return getSubscriptionChangePreview({
        data: input.data,
      });
    },
    {
      keepPreviousData: true,
      enabled: !!input.data,
    }
  );

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
