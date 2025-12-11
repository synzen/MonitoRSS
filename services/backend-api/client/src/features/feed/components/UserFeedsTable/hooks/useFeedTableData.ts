import { useMemo } from "react";
import { SortingState } from "@tanstack/react-table";
import { useUserFeedsInfinite } from "../../../hooks/useUserFeedsInfinite";
import { UserFeedComputedStatus } from "../../../types";
import { DEFAULT_MAX_PER_PAGE } from "../constants";

function convertSortStateToSortKey(state: SortingState): string | undefined {
  if (!state[0]) {
    return undefined;
  }

  return `${state[0].desc ? "-" : ""}${state[0].id}`;
}

interface UseFeedTableDataOptions {
  sorting: SortingState;
  statusFilters: UserFeedComputedStatus[];
  limit?: number;
}

export function useFeedTableData({
  sorting,
  statusFilters,
  limit = DEFAULT_MAX_PER_PAGE,
}: UseFeedTableDataOptions) {
  const {
    data,
    status,
    error,
    isFetching,
    search,
    setSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserFeedsInfinite({
    limit,
    sort: convertSortStateToSortKey(sorting),
    filters: {
      computedStatuses: statusFilters,
    },
  });

  const flatData = useMemo(() => data?.pages?.flatMap((page) => page.results) || [], [data]);

  const total = data?.pages[0]?.total || 0;

  return {
    data,
    flatData,
    total,
    status,
    error,
    isFetching,
    search,
    setSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}
