import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { categories, feeds } from "../constants/curatedFeedData";
import { useCuratedFeeds } from "./useCuratedFeeds";

describe("useCuratedFeeds", () => {
  describe("data.feeds", () => {
    it("returns all feeds when no params given", () => {
      const { result } = renderHook(() => useCuratedFeeds());

      expect(result.current.data.feeds.length).toBe(feeds.length);
    });

    it("filters feeds by category", () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }));

      expect(result.current.data.feeds.length).toBeGreaterThan(0);
      expect(result.current.data.feeds.every((f) => f.category === "gaming")).toBe(true);
    });

    it("returns empty array for unknown category", () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "nonexistent" }));

      expect(result.current.data.feeds).toEqual([]);
    });

    it("filters feeds by search query", () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "steam" }));

      expect(result.current.data.feeds.length).toBeGreaterThan(0);
      result.current.data.feeds.forEach((f) => {
        expect(f.title.toLowerCase()).toContain("steam");
      });
    });

    it("search is case-insensitive", () => {
      const { result: lower } = renderHook(() => useCuratedFeeds({ search: "steam" }));
      const { result: upper } = renderHook(() => useCuratedFeeds({ search: "STEAM" }));

      expect(lower.current.data.feeds).toEqual(upper.current.data.feeds);
    });

    it("search matches partial titles", () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "hack" }));

      expect(result.current.data.feeds.length).toBeGreaterThanOrEqual(2);
      expect(result.current.data.feeds.some((f) => f.title === "Hacker News (YC)")).toBe(true);
      expect(result.current.data.feeds.some((f) => f.title === "The Hacker News")).toBe(true);
    });

    it("returns empty feeds array for no search matches", () => {
      const { result } = renderHook(() => useCuratedFeeds({ search: "zzzznonexistent" }));

      expect(result.current.data.feeds).toEqual([]);
    });

    it("preserves popular field on feed entries", () => {
      const { result } = renderHook(() => useCuratedFeeds());
      const popularFeeds = result.current.data.feeds.filter((f) => f.popular);

      expect(popularFeeds.length).toBeGreaterThan(0);
      popularFeeds.forEach((f) => {
        expect(f.popular).toBe(true);
      });
    });
  });

  describe("data.categories", () => {
    it("returns all categories with counts", () => {
      const { result } = renderHook(() => useCuratedFeeds());

      expect(result.current.data.categories.length).toBe(categories.length);
      result.current.data.categories.forEach((cat) => {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("label");
        expect(cat).toHaveProperty("count");
        expect(cat.count).toBe(feeds.filter((f) => f.category === cat.id).length);
      });
    });

    it("returns full category list regardless of feed filter", () => {
      const { result } = renderHook(() => useCuratedFeeds({ category: "gaming" }));

      expect(result.current.data.categories.length).toBe(categories.length);
    });
  });

  describe("getHighlightFeeds", () => {
    it("returns first 3 feeds per category", () => {
      const { result } = renderHook(() => useCuratedFeeds());
      const highlights = result.current.getHighlightFeeds();

      expect(highlights.length).toBe(categories.length);
      highlights.forEach(({ feeds: catFeeds }) => {
        expect(catFeeds.length).toBeLessThanOrEqual(3);
        expect(catFeeds.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getCategoryPreviewText", () => {
    it("returns comma-separated titles with ellipsis when more than 3", () => {
      const { result } = renderHook(() => useCuratedFeeds());
      const text = result.current.getCategoryPreviewText("gaming");
      const parts = text.split(", ");

      expect(parts.length).toBe(3);
      expect(text.endsWith("...")).toBe(true);
    });
  });

  describe("async-ready interface", () => {
    it("returns isLoading as false", () => {
      const { result } = renderHook(() => useCuratedFeeds());

      expect(result.current.isLoading).toBe(false);
    });

    it("returns error as null", () => {
      const { result } = renderHook(() => useCuratedFeeds());

      expect(result.current.error).toBeNull();
    });
  });
});
