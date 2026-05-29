import { useQuery } from "@tanstack/react-query";
import { getCuratedFeeds } from "../api";
import type { CuratedCategory, CuratedFeed } from "../types";

const MIN_SEARCH_LENGTH = 3;
const STALE_TIME_MS = 5 * 60 * 1000;

function getCategoryMetadata(
  feeds: CuratedFeed[],
  categories: CuratedCategory[],
): Array<CuratedCategory & { count: number }> {
  return categories.map((cat) => ({
    ...cat,
    count: feeds.filter((f) => f.category === cat.id).length,
  }));
}

function getHighlightFeeds(
  feeds: CuratedFeed[],
  categories: CuratedCategory[],
): Array<{
  category: CuratedCategory;
  feeds: CuratedFeed[];
}> {
  return categories.map((cat) => ({
    category: cat,
    feeds: feeds.filter((f) => f.category === cat.id).slice(0, 3),
  }));
}

function getCategoryPreviewText(feeds: CuratedFeed[], categoryId: string): string {
  const categoryFeeds = feeds.filter((f) => f.category === categoryId);
  const first3 = categoryFeeds.slice(0, 3).map((f) => f.title);

  if (categoryFeeds.length > 3) {
    return `${first3.join(", ")}...`;
  }

  return first3.join(", ");
}

interface UseCuratedFeedsOptions {
  category?: string;
  search?: string;
  enabled?: boolean;
}

interface UseCuratedFeedsResult {
  data:
    | {
        feeds: CuratedFeed[];
        categories: Array<CuratedCategory & { count: number }>;
      }
    | undefined;
  getHighlightFeeds: () => Array<{ category: CuratedCategory; feeds: CuratedFeed[] }>;
  getCategoryPreviewText: (categoryId: string) => string;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

export function useCuratedFeeds(options?: UseCuratedFeedsOptions): UseCuratedFeedsResult {
  const search = options?.search?.trim() ?? "";
  const category = options?.category;
  const callerEnabled = options?.enabled !== false;
  const searchTooShort = search.length > 0 && search.length < MIN_SEARCH_LENGTH;

  const {
    data: queryData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery(
    ["curated-feeds", { search, category }],
    () => {
      if (search) {
        return getCuratedFeeds({ q: search });
      }

      if (category) {
        return getCuratedFeeds({ category });
      }

      return getCuratedFeeds();
    },
    {
      enabled: callerEnabled && !searchTooShort,
      staleTime: STALE_TIME_MS,
      keepPreviousData: true,
    },
  );

  const allFeeds = queryData?.result.feeds.filter((f) => f.category !== "other") ?? [];
  const allCategories = queryData?.result.categories.filter((c) => c.id !== "other") ?? [];

  const categories = getCategoryMetadata(allFeeds, allCategories);

  const data = queryData
    ? {
        feeds: allFeeds,
        categories,
      }
    : undefined;

  return {
    data,
    getHighlightFeeds: () => getHighlightFeeds(allFeeds, allCategories),
    getCategoryPreviewText: (categoryId: string) => getCategoryPreviewText(allFeeds, categoryId),
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
