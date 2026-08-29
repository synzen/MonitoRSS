import { SortingState } from "@tanstack/react-table";
import { useUserFeeds } from "../../../hooks/useUserFeeds";
import { UserFeedComputedStatus } from "../../../types";

function convertSortStateToSortKey(state: SortingState): string | undefined {
  if (!state[0]) {
    return undefined;
  }

  return `${state[0].desc ? "-" : ""}${state[0].id}`;
}

interface UseFeedTableDataOptions {
  sorting: SortingState;
  statusFilters: UserFeedComputedStatus[];
  page: number;
  pageSize: number;
  search: string;
}

export function useFeedTableData({
  sorting,
  statusFilters,
  page,
  pageSize,
  search,
}: UseFeedTableDataOptions) {
  const { data, status, error, isFetching } = useUserFeeds({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search,
    sort: convertSortStateToSortKey(sorting),
    filters: {
      computedStatuses: statusFilters,
    },
  });

  return {
    data,
    rows: data?.results || [],
    total: data?.total || 0,
    status,
    error,
    isFetching,
  };
}
