import { describe, it, expect } from "bun:test";
import { chunkArray } from "../src/shared/utils";
import {
  injectExternalContent,
  type ExternalFeedProperty,
  type ExternalFetchFn,
} from "../src/articles/parser";
import type { Article } from "../src/articles/parser";

describe("chunkArray", () => {
  it("splits array into chunks of specified size", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const result = chunkArray(arr, 3);

    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("returns single chunk when array is smaller than chunk size", () => {
    const arr = [1, 2];
    const result = chunkArray(arr, 5);

    expect(result).toEqual([[1, 2]]);
  });

  it("returns empty array for empty input", () => {
    const arr: number[] = [];
    const result = chunkArray(arr, 3);

    expect(result).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    const arr = ["a", "b", "c"];
    const result = chunkArray(arr, 1);

    expect(result).toEqual([["a"], ["b"], ["c"]]);
  });

  it("handles exact divisible array length", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const result = chunkArray(arr, 2);

    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });
});

describe("injectExternalContent", () => {
  const createArticle = (
    id: string,
    flattened: Record<string, string>
  ): Article => ({
    flattened: {
      id,
      idHash: `hash-${id}`,
      ...flattened,
    },
    raw: {},
  });

  describe("basic injection", () => {
    it("does nothing when no external properties", async () => {
      const articles = [
        createArticle("1", { title: "Test", link: "http://example.com" }),
      ];
      const fetchFn: ExternalFetchFn = async () =>
        "<html><body>Content</body></html>";

      await injectExternalContent(articles, [], fetchFn);

      // Only original fields should exist
      expect(Object.keys(articles[0]!.flattened)).toEqual([
        "id",
        "idHash",
        "title",
        "link",
      ]);
    });

    it("injects content from external URL", async () => {
      const articles = [
        createArticle("1", {
          title: "Test",
          link: "http://example.com/article",
        }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".article-body" },
      ];

      const fetchFn: ExternalFetchFn = async (url) => {
        if (url === "http://example.com/article") {
          return `<html><body><div class="article-body">Article content here</div></body></html>`;
        }
        return null;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      expect(articles[0]!.flattened["external::link::content0"]).toBe(
        '<div class="article-body">Article content here</div>'
      );
    });

    it("extracts images from injected content", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async () => {
        return `<html><body><div class="content"><img src="http://example.com/image.jpg" /></div></body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      expect(articles[0]!.flattened["external::link::content0::image0"]).toBe(
        "http://example.com/image.jpg"
      );
    });

    it("extracts anchors from injected content", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async () => {
        return `<html><body><div class="content"><a href="http://example.com/link">Click here</a></div></body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      expect(articles[0]!.flattened["external::link::content0::anchor0"]).toBe(
        "http://example.com/link"
      );
    });
  });

  describe("multiple matches", () => {
    it("injects multiple CSS selector matches (up to 10)", async () => {
      const articles = [createArticle("1", { link: "http://example.com" })];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "item", cssSelector: ".item" },
      ];

      const fetchFn: ExternalFetchFn = async () => {
        return `<html><body>
          <div class="item">Item 0</div>
          <div class="item">Item 1</div>
          <div class="item">Item 2</div>
        </body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      expect(articles[0]!.flattened["external::link::item0"]).toBe(
        '<div class="item">Item 0</div>'
      );
      expect(articles[0]!.flattened["external::link::item1"]).toBe(
        '<div class="item">Item 1</div>'
      );
      expect(articles[0]!.flattened["external::link::item2"]).toBe(
        '<div class="item">Item 2</div>'
      );
    });

    it("limits to 10 matches per selector", async () => {
      const articles = [createArticle("1", { link: "http://example.com" })];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "item", cssSelector: ".item" },
      ];

      // Generate 15 items
      const items = Array.from(
        { length: 15 },
        (_, i) => `<div class="item">Item ${i}</div>`
      );
      const fetchFn: ExternalFetchFn = async () => {
        return `<html><body>${items.join("")}</body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should have items 0-9, not 10-14
      expect(articles[0]!.flattened["external::link::item0"]).toBeDefined();
      expect(articles[0]!.flattened["external::link::item9"]).toBeDefined();
      expect(articles[0]!.flattened["external::link::item10"]).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("handles fetch failures gracefully", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async () => null;

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should not throw, and no external content should be added
      expect(
        articles[0]!.flattened["external::link::content0"]
      ).toBeUndefined();
    });

    it("handles invalid HTML gracefully", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      // Return something that's not valid HTML
      const fetchFn: ExternalFetchFn = async () => "";

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should not throw
      expect(
        articles[0]!.flattened["external::link::content0"]
      ).toBeUndefined();
    });

    it("skips articles without the source field", async () => {
      const articles = [
        createArticle("1", { title: "Test" }), // No "link" field
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      let fetchCalled = false;
      const fetchFn: ExternalFetchFn = async () => {
        fetchCalled = true;
        return "<html></html>";
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      expect(fetchCalled).toBe(false);
    });

    it("continues processing other properties when one fails", async () => {
      const articles = [
        createArticle("1", {
          link1: "http://example.com/fail",
          link2: "http://example.com/success",
        }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link1", label: "content1", cssSelector: ".content" },
        { sourceField: "link2", label: "content2", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async (url) => {
        if (url.includes("fail")) {
          return null;
        }
        return `<html><body><div class="content">Success</div></body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      // link1 should fail, link2 should succeed
      expect(
        articles[0]!.flattened["external::link1::content10"]
      ).toBeUndefined();
      expect(articles[0]!.flattened["external::link2::content20"]).toBe(
        '<div class="content">Success</div>'
      );
    });
  });

  describe("caching behavior", () => {
    it("processes multiple properties for same source field", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "title", cssSelector: ".title" },
        { sourceField: "link", label: "body", cssSelector: ".body" },
      ];

      const fetchFn: ExternalFetchFn = async () => {
        return `<html><body>
          <div class="title">Title</div>
          <div class="body">Body</div>
        </body></html>`;
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      // Both properties should extract content
      expect(articles[0]!.flattened["external::link::title0"]).toBe(
        '<div class="title">Title</div>'
      );
      expect(articles[0]!.flattened["external::link::body0"]).toBe(
        '<div class="body">Body</div>'
      );
    });
  });
});
