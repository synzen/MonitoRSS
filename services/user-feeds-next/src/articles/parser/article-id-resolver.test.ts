import { describe, expect, it, beforeEach, spyOn, mock } from "bun:test";
import { ArticleIDResolver } from ".";

describe("ArticleIDResolver", () => {
  const idTypeNames = ["guid", "pubdate", "title"];
  // Expected ID types include single types and merged pairs: guid, pubdate, title, guid,pubdate, guid,title, pubdate,title
  const expectedIDTypes = [
    "guid",
    "pubdate",
    "title",
    "guid,pubdate",
    "guid,title",
    "pubdate,title",
  ];

  describe("constructor", () => {
    it("adds all id types to this.useIdTypes", () => {
      const idResolver = new ArticleIDResolver();
      expect(idResolver.useIdTypes.size).toBe(expectedIDTypes.length);

      for (const item of expectedIDTypes) {
        expect(idResolver.useIdTypes.has(item)).toBe(true);
      }
    });

    it("adds all id types as an empty set in this.idsRecorded", () => {
      const idResolver = new ArticleIDResolver();

      for (const item of expectedIDTypes) {
        expect(idResolver.idsRecorded[item] instanceof Set).toBe(true);
      }
    });

    it("adds the merged id types to this.mergedTypeNames", () => {
      const idResolver = new ArticleIDResolver();
      const expectedMergedTypeNames = [
        "guid,pubdate",
        "guid,title",
        "pubdate,title",
      ];
      expect(idResolver.mergedTypeNames).toEqual(expectedMergedTypeNames);
    });
  });

  describe("getIDType()", () => {
    it("returns the first valid id type", () => {
      const idResolver = new ArticleIDResolver();
      // Clear merged types so they won't match
      idResolver.mergedTypeNames = ["lswikedgjowir", "rjhgyn;bkjdn"];
      expect(idResolver.getIDType()).toBe(idTypeNames[0]);
    });

    it("returns the first merged id type if there are invalids", () => {
      const idResolver = new ArticleIDResolver();

      // Remove all single id types
      for (const idType of idTypeNames) {
        idResolver.useIdTypes.delete(idType);
      }

      expect(idResolver.getIDType()).toBe(expectedIDTypes[3]); // guid,pubdate
    });

    it("returns the last failed id type if there are no valid id types", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes.clear();
      const failedType = "aedsgwtdrfkhjnb";
      idResolver.failedTypeNames.push(failedType);
      expect(idResolver.getIDType()).toBe(failedType);
    });
  });

  describe("static getIDTypeValue()", () => {
    it("returns the article value for non-merged id type", () => {
      const article = { id: "id", a: "b", dingus: "berry" };
      expect(ArticleIDResolver.getIDTypeValue(article, "a")).toBe(article.a);
    });

    it("returns the article values joined for a merged id type", () => {
      const article = { id: "id", joe: "poe", doe: "koe" };
      expect(ArticleIDResolver.getIDTypeValue(article, "doe,joe")).toBe(
        "koepoe"
      );
    });
  });

  describe("recordArticle()", () => {
    it("adds the articles values to their respective id type in this.idsRecorded", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a", "b"]);
      idResolver.idsRecorded.a = new Set();
      idResolver.idsRecorded.b = new Set();

      // Record an article with values for both types
      idResolver.recordArticle({ id: "1", a: "valueA", b: "valueB" });

      expect(idResolver.idsRecorded.a.has("valueA")).toBe(true);
      expect(idResolver.idsRecorded.b.has("valueB")).toBe(true);
    });

    it("deletes the id type from this.useIdTypes if there is no article value", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();

      // Record an article with no value for "a"
      idResolver.recordArticle({ id: "1" });

      expect(idResolver.useIdTypes.has("a")).toBe(false);
    });

    it("adds the id type to this.failedTypeNames if there is no article value", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();

      // Record an article with no value for "a"
      idResolver.recordArticle({ id: "1" });

      expect(idResolver.failedTypeNames.includes("a")).toBe(true);
    });

    it("deletes the id type from this.useIdTypes if the article value was seen before", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();

      // Record two articles with the same value
      idResolver.recordArticle({ id: "1", a: "duplicate" });
      idResolver.recordArticle({ id: "2", a: "duplicate" });

      expect(idResolver.useIdTypes.has("a")).toBe(false);
    });

    it("adds the id type to this.failedTypeNames if the article value was seen before", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();

      // Record two articles with the same value
      idResolver.recordArticle({ id: "1", a: "duplicate" });
      idResolver.recordArticle({ id: "2", a: "duplicate" });

      expect(idResolver.failedTypeNames.includes("a")).toBe(true);
    });
  });
});
