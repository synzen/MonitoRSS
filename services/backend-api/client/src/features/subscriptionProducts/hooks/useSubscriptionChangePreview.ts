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
  >({
    queryKey: [
      "subscription-change-preview",
      {
        input,
      },
    ],
    queryFn: async () => {
      if (!input.data) {
        throw new Error("Missing data when fetching subscription change preview");
      }

      return getSubscriptionChangePreview({
        data: input.data,
      });
    },
    enabled: !!input.data,
    gcTime: 0,
  });

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
