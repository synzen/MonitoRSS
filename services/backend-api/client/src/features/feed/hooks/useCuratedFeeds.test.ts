import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCuratedFeeds } from "./useCuratedFeeds";

const mockCategories = [
  { id: "gaming", label: "Gaming" },
  { id: "tech", label: "Tech & Security" },
];

const mockPopularFeeds = [
  {
    id: "mock0000000000000000000ign",
    title: "IGN",
    category: "gaming",
    domain: "ign.com",
    description: "Gaming news",
    popular: true,
  },
  {
    id: "mock00000000000000000steam",
    title: "Steam News",
    category: "gaming",
    domain: "store.steampowered.com",
    description: "Steam platform updates",
    popular: true,
  },
];

const mockGamingCategoryFeeds = [
  ...mockPopularFeeds,
  {
    id: "mock0000000000000000pcgamer",
    title: "PC Gamer",
    category: "gaming",
    domain: "pcgamer.com",
    description: "PC gaming news",
  },
];

const mockSearchFeeds = [
  {
    id: "mock0000000000000000hackers",
    title: "The Hacker News",
    category: "tech",
    domain: "thehackernews.com",
    description: "Cybersecurity news",
  },
];

const mockGetCuratedFeeds = vi.fn();

vi.mock("../api", () => ({
  getCuratedFeeds: (input?: { q?: string; category?: string }) => mockGetCuratedFeeds(input),
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
    mockGetCuratedFeeds.mockImplementation((input?: { q?: string; category?: string }) => {
      if (input?.q) {
        return Promise.resolve({
          result: { categories: mockCategories, feeds: mockSearchFeeds },
        });
      }
      if (input?.category === "gaming") {
        return Promise.resolve({
          result: { categories: mockCategories, feeds: mockGamingCategoryFeeds },
        });
      }
      return Promise.resolve({
        result: { categories: mockCategories, feeds: mockPopularFeeds },
      });
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

  describe("default mode (no options)", () => {
    it("calls API without params and returns popular feeds", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(mockGetCuratedFeeds).toHaveBeenCalledWith(undefined);
      expect(result.current.data!.feeds.length).toBe(mockPopularFeeds.length);
    });
  });

  describe("category mode", () => {
    it("calls API with category param", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(mockGetCuratedFeeds).toHaveBeenCalledWith({ category: "gaming" });
      expect(result.current.data!.feeds.length).toBe(mockGamingCategoryFeeds.length);
    });
  });

  describe("search mode", () => {
    it("calls API with q param when search is at least 3 chars", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "hack" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(mockGetCuratedFeeds).toHaveBeenCalledWith({ q: "hack" });
      expect(result.current.data!.feeds).toEqual(mockSearchFeeds);
    });

    it("skips the API call when search is shorter than 3 chars", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "hi" }), {
        wrapper: createWrapper(),
      });

      await new Promise((r) => setTimeout(r, 30));

      expect(mockGetCuratedFeeds).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("trims whitespace when computing search length", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "  hi  " }), {
        wrapper: createWrapper(),
      });

      await new Promise((r) => setTimeout(r, 30));

      expect(mockGetCuratedFeeds).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("data.categories", () => {
    it("returns categories with counts derived from returned feeds", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data!.categories.length).toBe(mockCategories.length);
      const gaming = result.current.data!.categories.find((c) => c.id === "gaming");
      expect(gaming?.count).toBe(2);
      const tech = result.current.data!.categories.find((c) => c.id === "tech");
      expect(tech?.count).toBe(0);
    });
  });

  describe("getHighlightFeeds", () => {
    it("returns up to 3 feeds per category from loaded set", async () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const highlights = result.current.getHighlightFeeds();
      expect(highlights.length).toBe(mockCategories.length);
      const gamingHighlight = highlights.find((h) => h.category.id === "gaming");
      expect(gamingHighlight?.feeds.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getCategoryPreviewText", () => {
    it("returns comma-separated titles when 3 or fewer feeds present", async () => {
      const { result } = renderHook(() => useCuratedFeeds(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const text = result.current.getCategoryPreviewText("gaming");
      expect(text).toContain("IGN");
      expect(text).toContain("Steam News");
    });
  });
});
