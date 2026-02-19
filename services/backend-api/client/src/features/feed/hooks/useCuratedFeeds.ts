import { useQuery } from "@tanstack/react-query";
import { getCuratedFeeds } from "../api";
import type { CuratedCategory, CuratedFeed } from "../types";

function filterByCategory(feeds: CuratedFeed[], categoryId: string): CuratedFeed[] {
  return feeds.filter((feed) => feed.category === categoryId);
}

function searchByTitle(feeds: CuratedFeed[], query: string): CuratedFeed[] {
  const lowerQuery = query.toLowerCase();

  return feeds.filter((feed) => feed.title.toLowerCase().includes(lowerQuery));
}

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
  error: unknown;
  refetch: () => void;
}

export function useCuratedFeeds(options?: UseCuratedFeedsOptions): UseCuratedFeedsResult {
  const {
    data: queryData,
    isLoading,
    error,
    refetch,
  } = useQuery(["curated-feeds"], getCuratedFeeds, {
    staleTime: Infinity,
  });

  const allFeeds = queryData?.result.feeds ?? [];
  const allCategories = queryData?.result.categories ?? [];

  let feeds = allFeeds;

  if (options?.category) {
    feeds = filterByCategory(allFeeds, options.category);
  } else if (options?.search) {
    feeds = searchByTitle(allFeeds, options.search);
  }

  const categories = getCategoryMetadata(allFeeds, allCategories);

  const data = queryData
    ? {
        feeds,
        categories,
      }
    : undefined;

  return {
    data,
    getHighlightFeeds: () => getHighlightFeeds(allFeeds, allCategories),
    getCategoryPreviewText: (categoryId: string) => getCategoryPreviewText(allFeeds, categoryId),
    isLoading,
    error,
    refetch,
  };
}
