import { useMemo } from "react";
import { useDeliveryPreview } from "./useDeliveryPreview";

interface Props {
  feedId?: string;
  limit?: number;
  disabled?: boolean;
}

export const useDeliveryPreviewWithPagination = ({ feedId, limit, disabled }: Props) => {
  const useLimit = limit || 10;

  const { error, data, status, fetchStatus, refetch, dataUpdatedAt, fetchNextPage, hasNextPage } =
    useDeliveryPreview({
      feedId,
      data: {
        skip: 0,
        limit: useLimit,
      },
      disabled,
    });

  const allResults = data?.pages.flatMap((p) => p.result.results) || [];

  const total = data?.pages[0].result.total || 0;
  const feedState = data?.pages[0].result.feedState;

  const lastChecked = useMemo(
    () => (!dataUpdatedAt ? new Date() : new Date(dataUpdatedAt)),
    [dataUpdatedAt]
  );

  return {
    results: allResults,
    error,
    status,
    fetchStatus,
    loadMore: fetchNextPage,
    refresh: refetch,
    hasMore: hasNextPage,
    total,
    lastChecked,
    limit: useLimit,
    feedState,
  };
};
