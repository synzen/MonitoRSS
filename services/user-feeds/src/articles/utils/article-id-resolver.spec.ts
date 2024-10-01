import { ArticleIDResolver } from "./article-id-resolver";
import { describe, before, after, beforeEach, it, mock } from "node:test";
import { deepEqual } from "node:assert";

describe("ArticleIDResolver", () => {
  const spy = mock.getter(ArticleIDResolver, "ID_TYPE_NAMES");
  const idTypeNames = ["a", "b", "c"];
  const expectedIDTypes = ["a", "b", "c", "a,b", "a,c", "b,c"];

  describe("constructor", () => {
    beforeEach(() => {
      spy.mock.mockImplementation(() => idTypeNames);
    });
    it("adds all id types to this.useIdTypes", () => {
      const idResolver = new ArticleIDResolver();
      deepEqual(idResolver.useIdTypes.size, expectedIDTypes.length);

      for (const item of expectedIDTypes) {
        deepEqual(idResolver.useIdTypes.has(item), true);
      }
    });

    it("adds all id types as an empty set in this.idsRecorded", () => {
      const idResolver = new ArticleIDResolver();

      for (const item of expectedIDTypes) {
        deepEqual(idResolver.idsRecorded[item] instanceof Set, true);
      }
    });

    it("adds the merged id types to this.mergedTypeNames", () => {
      const idResolver = new ArticleIDResolver();
      const expectedMergedTypeNames = ["a,b", "a,c", "b,c"];
      deepEqual(idResolver.mergedTypeNames, expectedMergedTypeNames);
    });
  });

  describe("getIDType()", () => {
    it("returns the first valid id type", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.mergedTypeNames = ["lswikedgjowir", "rjhgyn;bkjdn"];
      deepEqual(idResolver.getIDType(), idTypeNames[0]);
    });

    it("returns the first merged id type if there are invalids", () => {
      const idResolver = new ArticleIDResolver();

      for (const idType of idTypeNames) {
        idResolver.useIdTypes.delete(idType);
      }

      deepEqual(idResolver.getIDType(), expectedIDTypes[3]);
    });

    it("returns the last failed id type if there are no valid id types", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes.clear();
      const failedType = "aedsgwtdrfkhjnb";
      idResolver.failedTypeNames.push(failedType);
      deepEqual(idResolver.getIDType(), failedType);
    });
  });

  describe("static getIDTypeValue()", () => {
    it("returns the article value for non-merged id type", () => {
      const article = { id: "id", a: "b", dingus: "berry" };
      deepEqual(ArticleIDResolver.getIDTypeValue(article, "a"), article.a);
    });

    it("returns the article values joined for a merged id type", () => {
      const article = { id: "id", joe: "poe", doe: "koe" };
      deepEqual(ArticleIDResolver.getIDTypeValue(article, "doe,joe"), "koepoe");
    });
  });

  describe("recordArticle()", () => {
    const mockArticleValue = "adegtrhfnj";
    const spy = mock.method(ArticleIDResolver, "getIDTypeValue");

    before(() => {
      spy.mock.mockImplementation(() => mockArticleValue);
      // spy.mockReturnValue(mockArticleValue);
    });

    after(() => {
      spy.mock.restore();
    });

    it("adds the articles values to their respective id type in this.idsRecorded", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a", "b"]);
      idResolver.idsRecorded.a = new Set();
      idResolver.idsRecorded.b = new Set();
      // This can be empty since article values are accessed with ArticleIDResolve.getIDTypeValue
      idResolver.recordArticle({ id: "1" });
      deepEqual(idResolver.idsRecorded.a.has(mockArticleValue), true);
      deepEqual(idResolver.idsRecorded.b.has(mockArticleValue), true);
    });

    it("deletes the id type from this.useIdTypes if there is no article value", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();
      spy.mock.mockImplementationOnce(() => "");
      idResolver.recordArticle({ id: "1" });
      deepEqual(idResolver.useIdTypes.has("a"), false);
    });

    it("adds the id type from this.failedTypeNames if there is no article value", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();
      spy.mock.mockImplementationOnce(() => "");
      idResolver.recordArticle({ id: "1" });
      deepEqual(idResolver.failedTypeNames.includes("a"), true);
    });

    it("deletes the id type from this.useIdTypes if the article value was seen before", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();
      idResolver.recordArticle({ id: "1" });
      idResolver.recordArticle({ id: "2" });
      deepEqual(idResolver.useIdTypes.has("a"), false);
    });

    it("adds the id type from this.failedTypeNames if there is no article value", () => {
      const idResolver = new ArticleIDResolver();
      idResolver.useIdTypes = new Set(["a"]);
      idResolver.idsRecorded.a = new Set();
      idResolver.recordArticle({ id: "1" });
      idResolver.recordArticle({ id: "2" });
      deepEqual(idResolver.failedTypeNames.includes("a"), true);
    });
  });
});
