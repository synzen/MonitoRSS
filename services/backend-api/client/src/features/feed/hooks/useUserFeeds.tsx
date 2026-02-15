import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { pick } from "lodash";
import { getUserFeeds, GetUserFeedsInput, GetUserFeedsOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { UserFeed } from "../types";

export const useUserFeeds = (
  input: GetUserFeedsInput,
  opts?: {
    enabled?: boolean;
  },
) => {
  const [search, setSearch] = useState("");
  const [hasErrored, setHasErrored] = useState(false);
  const queryClient = useQueryClient();

  const queryKey = [
    "user-feeds",
    {
      input,
    },
  ];

  const { data, status, error, isFetching, isPreviousData, isLoading, refetch } = useQuery<
    GetUserFeedsOutput,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      const result = await getUserFeeds(input);

      return result;
    },
    {
      enabled: !hasErrored && opts?.enabled !== false,
      keepPreviousData: true,
      onError: () => {
        setHasErrored(true);
      },
    },
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
