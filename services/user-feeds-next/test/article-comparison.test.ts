import { describe, expect, it, beforeEach } from "bun:test";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
  clearInMemoryStore,
} from "../src/article-comparison";
import type { Article } from "../src/article-parser";

function createArticle(
  id: string,
  fields: Record<string, string> = {}
): Article {
  return {
    flattened: {
      id,
      idHash: `hash-${id}`,
      ...fields,
    },
    raw: {},
  };
}

describe("article-comparison", () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  describe("getArticlesToDeliver", () => {
    it("delivers nothing on first run (stores articles)", async () => {
      const articles = [
        createArticle("1", { title: "Article 1" }),
        createArticle("2", { title: "Article 2" }),
      ];

      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        articles,
        { blockingComparisons: [], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("delivers new articles on subsequent runs", async () => {
      // First run - stores articles
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // Second run - new article should be delivered
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [
          createArticle("1", { title: "Article 1" }),
          createArticle("2", { title: "Article 2" }),
        ],
        { blockingComparisons: [], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesToDeliver[0]!.flattened.id).toBe("2");
    });

    it("blocks articles with seen blocking comparison fields", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: ["title"], passingComparisons: [] }
      );

      // Second run - new ID but same title should be blocked
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [
          createArticle("1", { title: "Same Title" }),
          createArticle("2", { title: "Same Title" }), // Same title as article 1
        ],
        { blockingComparisons: ["title"], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
      expect(result.articlesBlocked.length).toBe(1);
    });

    it("passes articles with changed passing comparison fields", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Original Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      // Second run - same ID but different title should pass
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Updated Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesPassed.length).toBe(1);
    });

    it("does not deliver seen articles with unchanged passing comparisons", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      // Second run - same ID and same title should not deliver
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("isolates articles by feed ID", async () => {
      // Store article for feed-1
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // Same article ID for feed-2 should be new
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-2",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // First run for feed-2, so nothing delivered
      expect(result.articlesToDeliver.length).toBe(0);
    });
  });
});
