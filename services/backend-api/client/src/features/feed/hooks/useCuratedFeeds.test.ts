import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCuratedFeeds } from "./useCuratedFeeds";

const mockCategories = [
  { id: "gaming", label: "Gaming" },
  { id: "tech", label: "Tech & Security" },
];

const mockFeeds = [
  {
    url: "https://feeds.feedburner.com/ign/games",
    title: "IGN",
    category: "gaming",
    domain: "ign.com",
    description: "Gaming news",
    popular: true,
  },
  {
    url: "https://store.steampowered.com/feeds/news.xml",
    title: "Steam News",
    category: "gaming",
    domain: "store.steampowered.com",
    description: "Steam platform updates",
    popular: true,
  },
  {
    url: "https://www.pcgamer.com/rss/",
    title: "PC Gamer",
    category: "gaming",
    domain: "pcgamer.com",
    description: "PC gaming news",
  },
  {
    url: "https://example.com/gaming4",
    title: "Gaming Feed 4",
    category: "gaming",
    domain: "example.com",
    description: "Another gaming feed",
  },
  {
    url: "https://feeds.feedburner.com/TheHackersNews",
    title: "The Hacker News",
    category: "tech",
    domain: "thehackernews.com",
    description: "Cybersecurity news",
  },
  {
    url: "https://news.ycombinator.com/rss",
    title: "Hacker News (YC)",
    category: "tech",
    domain: "news.ycombinator.com",
    description: "Social tech news",
  },
];

const mockGetCuratedFeeds = vi.fn();

vi.mock("../api", () => ({
  getCuratedFeeds: () => mockGetCuratedFeeds(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCuratedFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCuratedFeeds.mockResolvedValue({
      result: { categories: mockCategories, feeds: mockFeeds },
    });
  });

  describe("loading lifecycle", () => {
    it("starts with isLoading true and data undefined", () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("resolves to isLoading false with data defined", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("returns error when API call fails", async () => {
      mockGetCuratedFeeds.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("refetch", () => {
    it("exposes refetch function", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("data.feeds", () => {
    it("returns all feeds when no params given", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds.length).toBe(mockFeeds.length);
    });

    it("filters feeds by category", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds.length).toBeGreaterThan(0);
      expect(result.current.data!.feeds.every((f) => f.category === "gaming")).toBe(true);
    });

    it("returns empty array for unknown category", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "nonexistent" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds).toEqual([]);
    });

    it("filters feeds by search query", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "steam" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds.length).toBeGreaterThan(0);
      result.current.data!.feeds.forEach((f) => {
        expect(f.title.toLowerCase()).toContain("steam");
      });
    });

    it("search is case-insensitive", async () => {
      const wrapper = createWrapper();
      const { result: lower } = renderHook(() => useCuratedFeeds({ search: "steam" }), {
        wrapper,
      });
      const { result: upper } = renderHook(() => useCuratedFeeds({ search: "STEAM" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(lower.current.data).toBeDefined();
        expect(upper.current.data).toBeDefined();
      });

      expect(lower.current.data!.feeds).toEqual(upper.current.data!.feeds);
    });

    it("search matches partial titles", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "hack" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds.length).toBeGreaterThanOrEqual(2);
      expect(result.current.data!.feeds.some((f) => f.title === "Hacker News (YC)")).toBe(true);
      expect(result.current.data!.feeds.some((f) => f.title === "The Hacker News")).toBe(true);
    });

    it("returns empty feeds array for no search matches", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "zzzznonexistent" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.feeds).toEqual([]);
    });

    it("preserves popular field on feed entries", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const popularFeeds = result.current.data!.feeds.filter((f) => f.popular);
      expect(popularFeeds.length).toBeGreaterThan(0);
      popularFeeds.forEach((f) => {
        expect(f.popular).toBe(true);
      });
    });
  });

  describe("data.categories", () => {
    it("returns all categories with counts", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.categories.length).toBe(mockCategories.length);
      result.current.data!.categories.forEach((cat) => {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("label");
        expect(cat).toHaveProperty("count");
        expect(cat.count).toBe(mockFeeds.filter((f) => f.category === cat.id).length);
      });
    });

    it("returns full category list regardless of feed filter", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.categories.length).toBe(mockCategories.length);
    });
  });

  describe("getHighlightFeeds", () => {
    it("returns first 3 feeds per category", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const highlights = result.current.getHighlightFeeds();
      expect(highlights.length).toBe(mockCategories.length);
      highlights.forEach(({ feeds: catFeeds }) => {
        expect(catFeeds.length).toBeLessThanOrEqual(3);
        expect(catFeeds.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getCategoryPreviewText", () => {
    it("returns comma-separated titles with ellipsis when more than 3", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const text = result.current.getCategoryPreviewText("gaming");
      const parts = text.split(", ");

      expect(parts.length).toBe(3);
      expect(text.endsWith("...")).toBe(true);
    });
  });
});
