import { useInfiniteQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  GetDeliveryPreviewInput,
  GetDeliveryPreviewOutput,
  getDeliveryPreview,
} from "../api/getDeliveryPreview";

interface Props {
  feedId?: string;
  data: GetDeliveryPreviewInput["data"];
  disabled?: boolean;
}

export const useDeliveryPreview = ({ feedId, data: inputData, disabled }: Props) => {
  const queryKey = [
    "delivery-preview",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus, refetch, dataUpdatedAt, fetchNextPage, hasNextPage } =
    useInfiniteQuery<GetDeliveryPreviewOutput, ApiAdapterError | Error>(
      queryKey,
      async ({ pageParam: skip }) => {
        if (!feedId) {
          throw new Error("Feed ID is required to fetch delivery preview");
        }

        return getDeliveryPreview({
          feedId,
          data: {
            ...inputData,
            skip,
          },
        });
      },
      {
        enabled: !!feedId && !disabled,
        keepPreviousData: true,
        refetchOnWindowFocus: false,
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.result.results.length < inputData.limit) {
            return undefined;
          }

          return allPages.length * inputData.limit;
        },
      }
    );

  return {
    data,
    status,
    error,
    fetchStatus,
    refetch,
    dataUpdatedAt,
    fetchNextPage,
    hasNextPage,
  };
};
