import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { pick } from "lodash";
import { getUserFeeds, GetUserFeedsInput, GetUserFeedsOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { UserFeed } from "../types";
import { useFeedScope } from "../contexts/FeedScopeContext";

export const useUserFeeds = (
  input: GetUserFeedsInput,
  opts?: {
    enabled?: boolean;
  },
) => {
  const [search, setSearch] = useState("");
  const [hasErrored, setHasErrored] = useState(false);
  const queryClient = useQueryClient();
  const { workspaceId } = useFeedScope();

  // In workspace scope, list/count this workspace's feeds; in personal scope, the user's.
  // Merged into the query key so the two scopes cache separately.
  const scopedInput: GetUserFeedsInput = { ...input, workspaceId: input.workspaceId ?? workspaceId };

  const queryKey = [
    "user-feeds",
    {
      input: scopedInput,
    },
  ];

  const { data, status, error, isFetching, isPreviousData, isLoading, refetch } = useQuery<
    GetUserFeedsOutput,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      const result = await getUserFeeds(scopedInput);

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
      feedsWithoutConnections: data.feedsWithoutConnections,
    });
  };

  return {
    data,
    status,
    error,
    setSearch,
    isFetchingNewPage,
    isFetching,
    // True while `data` still holds the previous query key's result (e.g. the prior
    // scope's feeds during a scope switch, kept by keepPreviousData until the refetch
    // resolves). Callers deriving state from `data` should ignore it while stale.
    isPreviousData,
    refetch,
    search: search || "",
    updateCachedFeed,
  };
};
