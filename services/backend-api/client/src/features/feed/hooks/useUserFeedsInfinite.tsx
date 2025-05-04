import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getUserFeeds, GetUserFeedsInput, GetUserFeedsOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";

export const useUserFeedsInfinite = (
  input: Omit<GetUserFeedsInput, "search">,
  opts?: {
    disabled?: boolean;
  }
) => {
  const [search, setSearch] = useState("");
  const useLimit = input.limit || 10;

  const queryKey = [
    "user-feeds",
    {
      input: {
        ...input,
        infinite: true,
        limit: useLimit,
        search,
      },
    },
  ];

  const {
    data,
    status,
    error,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    isFetchedAfterMount,
    fetchStatus,
  } = useInfiniteQuery<GetUserFeedsOutput, ApiAdapterError>(
    queryKey,
    async ({ pageParam: newOffset }) => {
      const result = await getUserFeeds({
        ...input,
        offset: newOffset,
        search,
      });

      return result;
    },
    {
      enabled: !opts?.disabled,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      // Returns the next offset
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.results.length < useLimit) {
          return undefined;
        }

        return allPages.length * useLimit;
      },
    }
  );

  return {
    data,
    status,
    error,
    fetchNextPage,
    isFetching,
    setSearch,
    hasNextPage,
    isFetchingNextPage,
    search: search || "",
    isFetchedAfterMount,
    fetchStatus,
  };
};
