import {
  InfiniteData,
  keepPreviousData,
  QueryKey,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
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
  const queryClient = useQueryClient();
  const queryKey = [
    "delivery-preview",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus, refetch, dataUpdatedAt, fetchNextPage, hasNextPage } =
    useInfiniteQuery<
      GetDeliveryPreviewOutput,
      ApiAdapterError | Error,
      InfiniteData<GetDeliveryPreviewOutput>,
      QueryKey,
      number
    >({
      queryKey,
      queryFn: async ({ pageParam: skip }) => {
        if (!feedId) {
          throw new Error("Feed ID is required to fetch delivery preview");
        }

        return getDeliveryPreview({
          feedId,
          data: {
            ...inputData,
            skip: skip ?? 0,
          },
        });
      },
      enabled: !!feedId && !disabled,
      initialPageParam: 0,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.result.results.length < inputData.limit) {
          return undefined;
        }

        return allPages.length * inputData.limit;
      },
    });

  useEffect(() => {
    if (status === "success") {
      // The preview may have triggered a feed request, so the request
      // history needs to pick up the new row.
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === "user-feed-requests" &&
            (query.queryKey[1] as { feedId?: string })?.feedId === feedId
          );
        },
      });
    }
  }, [status, dataUpdatedAt, feedId, queryClient]);

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
