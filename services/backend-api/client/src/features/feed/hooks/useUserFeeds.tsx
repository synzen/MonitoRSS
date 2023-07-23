import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { pick } from "lodash";
import { getUserFeeds, GetUserFeedsOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { UserFeed } from "../types";

interface Props {
  limit: number;
  offset: number;
  sort?: string;
}

export const useUserFeeds = ({ limit, offset, sort }: Props) => {
  const [search, setSearch] = useState("");
  const [hasErrored, setHasErrored] = useState(false);
  const queryClient = useQueryClient();

  const queryKey = [
    "user-feeds",
    {
      limit,
      offset,
      search: search || "",
      sort,
    },
  ];

  const { data, status, error, isFetching, isPreviousData, isLoading, refetch } = useQuery<
    GetUserFeedsOutput,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      const result = await getUserFeeds({
        limit,
        offset,
        search,
        sort,
      });

      return result;
    },
    {
      enabled: !hasErrored,
      keepPreviousData: true,
      onError: () => {
        setHasErrored(true);
      },
    }
  );

  const isFetchingNewPage = isLoading || (isFetching && isPreviousData);

  const updateCachedFeed = (feedId: string, details: Partial<UserFeed>) => {
    const existingFeed = data?.results.find((feed) => feed.id === feedId);

    if (!data || !existingFeed) {
      return;
    }

    const updatedFeeds = data.results.map((feed) => {
      if (feed.id === feedId) {
        const updatedFields = pick(details, Object.keys(feed));

        return {
          ...feed,
          ...updatedFields,
        };
      }

      return feed;
    });

    queryClient.setQueryData<GetUserFeedsOutput>(queryKey, {
      results: updatedFeeds,
      total: data.total,
    });
  };

  return {
    data,
    status,
    error,
    setSearch,
    isFetchingNewPage,
    isFetching,
    refetch,
    search: search || "",
    updateCachedFeed,
  };
};
