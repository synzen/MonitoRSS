import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getUserFeeds, GetUserFeedsOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";

interface Props {
  sort?: string;
  limit: number;
}

export const useUserFeedsInfinite = ({ sort, limit }: Props) => {
  const [search, setSearch] = useState("");

  const queryKey = [
    "user-feeds",
    {
      infinite: true,
      search: search || "",
      sort,
      limit,
    },
  ];

  const { data, status, error, fetchNextPage, isFetching, isFetchingNextPage, hasNextPage } =
    useInfiniteQuery<GetUserFeedsOutput, ApiAdapterError>(
      queryKey,
      async ({ pageParam: newOffset }) => {
        const result = await getUserFeeds({
          search,
          sort,
          limit,
          offset: newOffset,
        });

        return result;
      },
      {
        keepPreviousData: true,
        refetchOnWindowFocus: false,
        // Returns the next offset
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.results.length < limit) {
            return undefined;
          }

          return allPages.length * limit;
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
  };
};
