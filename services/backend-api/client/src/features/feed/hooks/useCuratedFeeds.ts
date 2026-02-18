import {
  categories as allCategories,
  feeds as allFeeds,
  CuratedCategory,
  CuratedFeed,
} from "../constants/curatedFeedData";

function filterByCategory(feeds: CuratedFeed[], categoryId: string): CuratedFeed[] {
  return feeds.filter((feed) => feed.category === categoryId);
}

function searchByTitle(feeds: CuratedFeed[], query: string): CuratedFeed[] {
  const lowerQuery = query.toLowerCase();

  return feeds.filter((feed) => feed.title.toLowerCase().includes(lowerQuery));
}

function getCategoryMetadata(
  feeds: CuratedFeed[],
  categories: CuratedCategory[]
): Array<CuratedCategory & { count: number }> {
  return categories.map((cat) => ({
    ...cat,
    count: feeds.filter((f) => f.category === cat.id).length,
  }));
}

function getHighlightFeeds(
  feeds: CuratedFeed[],
  categories: CuratedCategory[]
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
  data: {
    feeds: CuratedFeed[];
    categories: Array<CuratedCategory & { count: number }>;
  };
  getHighlightFeeds: () => Array<{ category: CuratedCategory; feeds: CuratedFeed[] }>;
  getCategoryPreviewText: (categoryId: string) => string;
  isLoading: false;
  error: null;
}

export function useCuratedFeeds(options?: UseCuratedFeedsOptions): UseCuratedFeedsResult {
  let feeds = allFeeds;

  if (options?.category) {
    feeds = filterByCategory(allFeeds, options.category);
  } else if (options?.search) {
    feeds = searchByTitle(allFeeds, options.search);
  }

  const categories = getCategoryMetadata(allFeeds, allCategories);

  return {
    data: {
      feeds,
      categories,
    },
    getHighlightFeeds: () => getHighlightFeeds(allFeeds, allCategories),
    getCategoryPreviewText: (categoryId: string) => getCategoryPreviewText(allFeeds, categoryId),
    isLoading: false,
    error: null,
  };
}
