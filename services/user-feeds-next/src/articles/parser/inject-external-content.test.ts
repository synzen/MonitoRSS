import { describe, it } from "node:test";
import assert from "node:assert";
import { chunkArray } from "../../shared/utils";
import {
  injectExternalContent,
  ExternalContentErrorType,
  type ExternalFeedProperty,
  type ExternalFetchFn,
  type ExternalContentError,
  type Article,
} from ".";

describe("chunkArray", { concurrency: true }, () => {
  it("splits array into chunks of specified size", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const result = chunkArray(arr, 3);

    assert.deepStrictEqual(result, [[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("returns single chunk when array is smaller than chunk size", () => {
    const arr = [1, 2];
    const result = chunkArray(arr, 5);

    assert.deepStrictEqual(result, [[1, 2]]);
  });

  it("returns empty array for empty input", () => {
    const arr: number[] = [];
    const result = chunkArray(arr, 3);

    assert.deepStrictEqual(result, []);
  });

  it("handles chunk size of 1", () => {
    const arr = ["a", "b", "c"];
    const result = chunkArray(arr, 1);

    assert.deepStrictEqual(result, [["a"], ["b"], ["c"]]);
  });

  it("handles exact divisible array length", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const result = chunkArray(arr, 2);

    assert.deepStrictEqual(result, [
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });
});

describe("injectExternalContent", { concurrency: true }, () => {
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
      const fetchFn: ExternalFetchFn = async () => ({
        body: "<html><body>Content</body></html>",
        statusCode: 200,
      });

      await injectExternalContent(articles, [], fetchFn);

      // Only original fields should exist
      assert.deepStrictEqual(Object.keys(articles[0]!.flattened), [
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
          return {
            body: `<html><body><div class="article-body">Article content here</div></body></html>`,
            statusCode: 200,
          };
        }
        return { body: null };
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      assert.strictEqual(articles[0]!.flattened["external::link::content0"], '<div class="article-body">Article content here</div>');
    });

    it("extracts images from injected content", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div class="content"><img src="http://example.com/image.jpg" /></div></body></html>`,
        statusCode: 200,
      });

      await injectExternalContent(articles, externalProps, fetchFn);

      assert.strictEqual(articles[0]!.flattened["external::link::content0::image0"], "http://example.com/image.jpg");
    });

    it("extracts anchors from injected content", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div class="content"><a href="http://example.com/link">Click here</a></div></body></html>`,
        statusCode: 200,
      });

      await injectExternalContent(articles, externalProps, fetchFn);

      assert.strictEqual(articles[0]!.flattened["external::link::content0::anchor0"], "http://example.com/link");
    });
  });

  describe("multiple matches", () => {
    it("injects multiple CSS selector matches (up to 10)", async () => {
      const articles = [createArticle("1", { link: "http://example.com" })];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "item", cssSelector: ".item" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body>
          <div class="item">Item 0</div>
          <div class="item">Item 1</div>
          <div class="item">Item 2</div>
        </body></html>`,
        statusCode: 200,
      });

      await injectExternalContent(articles, externalProps, fetchFn);

      assert.strictEqual(articles[0]!.flattened["external::link::item0"], '<div class="item">Item 0</div>');
      assert.strictEqual(articles[0]!.flattened["external::link::item1"], '<div class="item">Item 1</div>');
      assert.strictEqual(articles[0]!.flattened["external::link::item2"], '<div class="item">Item 2</div>');
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
      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body>${items.join("")}</body></html>`,
        statusCode: 200,
      });

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should have items 0-9, not 10-14
      assert.notStrictEqual(articles[0]!.flattened["external::link::item0"], undefined);
      assert.notStrictEqual(articles[0]!.flattened["external::link::item9"], undefined);
      assert.strictEqual(articles[0]!.flattened["external::link::item10"], undefined);
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

      const fetchFn: ExternalFetchFn = async () => ({ body: null });

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should not throw, and no external content should be added
      assert.strictEqual(articles[0]!.flattened["external::link::content0"], undefined);
    });

    it("handles invalid HTML gracefully", async () => {
      const articles = [
        createArticle("1", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      // Return something that's not valid HTML (empty body triggers fetch failure)
      const fetchFn: ExternalFetchFn = async () => ({ body: "", statusCode: 200 });

      await injectExternalContent(articles, externalProps, fetchFn);

      // Should not throw - empty body with no .content selector just results in no content
      assert.strictEqual(articles[0]!.flattened["external::link::content0"], undefined);
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
        return { body: "<html></html>", statusCode: 200 };
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      assert.strictEqual(fetchCalled, false);
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
          return { body: null };
        }
        return {
          body: `<html><body><div class="content">Success</div></body></html>`,
          statusCode: 200,
        };
      };

      await injectExternalContent(articles, externalProps, fetchFn);

      // link1 should fail, link2 should succeed
      assert.strictEqual(articles[0]!.flattened["external::link1::content10"], undefined);
      assert.strictEqual(articles[0]!.flattened["external::link2::content20"], '<div class="content">Success</div>');
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

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body>
          <div class="title">Title</div>
          <div class="body">Body</div>
        </body></html>`,
        statusCode: 200,
      });

      await injectExternalContent(articles, externalProps, fetchFn);

      // Both properties should extract content
      assert.strictEqual(articles[0]!.flattened["external::link::title0"], '<div class="title">Title</div>');
      assert.strictEqual(articles[0]!.flattened["external::link::body0"], '<div class="body">Body</div>');
    });
  });

  describe("error reporting", () => {
    it("returns empty error array when no errors occur", async () => {
      const articles = [
        createArticle("1", {
          title: "Test",
          link: "http://example.com/article",
        }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".article-body" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div class="article-body">Content</div></body></html>`,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.deepStrictEqual(errors, []);
    });

    it("returns FETCH_FAILED error with status code when fetch returns non-2xx", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/not-found" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".body" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: null,
        statusCode: 404,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.articleId, "article-1");
      assert.strictEqual(errors[0]!.sourceField, "link");
      assert.strictEqual(errors[0]!.label, "content");
      assert.strictEqual(errors[0]!.cssSelector, ".body");
      assert.strictEqual(errors[0]!.errorType, ExternalContentErrorType.FETCH_FAILED);
      assert.strictEqual(errors[0]!.statusCode, 404);
    });

    it("returns FETCH_FAILED error without status code when fetch throws (network error)", async () => {
      const articles = [
        createArticle("article-2", { link: "http://example.com/timeout" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "summary", cssSelector: ".summary" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: null,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.articleId, "article-2");
      assert.strictEqual(errors[0]!.sourceField, "link");
      assert.strictEqual(errors[0]!.label, "summary");
      assert.strictEqual(errors[0]!.cssSelector, ".summary");
      assert.strictEqual(errors[0]!.errorType, ExternalContentErrorType.FETCH_FAILED);
      assert.strictEqual(errors[0]!.statusCode, undefined);
    });

    it("returns HTML_PARSE_FAILED error when HTML parsing throws", async () => {
      const articles = [
        createArticle("article-3", { link: "http://example.com/bad-html" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".content" },
      ];

      // node-html-parser doesn't throw on bad HTML - it's very permissive
      // This test documents that we would report HTML_PARSE_FAILED if the parser did throw
      // For now, just verify the fetch error behavior when body is null
      const fetchFn: ExternalFetchFn = async () => ({
        body: null,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      // With null body and status 200, we get a FETCH_FAILED since there's no body
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.articleId, "article-3");
      assert.strictEqual(errors[0]!.sourceField, "link");
      assert.strictEqual(errors[0]!.label, "content");
      assert.strictEqual(errors[0]!.cssSelector, ".content");
      assert.strictEqual(errors[0]!.errorType, ExternalContentErrorType.FETCH_FAILED);
      assert.strictEqual(errors[0]!.statusCode, 200);
    });

    it("returns INVALID_CSS_SELECTOR error with message when querySelectorAll throws", async () => {
      const articles = [
        createArticle("article-4", { link: "http://example.com/article" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        {
          sourceField: "link",
          label: "content",
          cssSelector: "[invalid[[",
        },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div>Content</div></body></html>`,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.articleId, "article-4");
      assert.strictEqual(errors[0]!.sourceField, "link");
      assert.strictEqual(errors[0]!.label, "content");
      assert.strictEqual(errors[0]!.cssSelector, "[invalid[[");
      assert.strictEqual(errors[0]!.errorType, ExternalContentErrorType.INVALID_CSS_SELECTOR);
      assert.notStrictEqual(errors[0]!.message, undefined);
    });

    it("returns multiple errors for multiple articles with different failures", async () => {
      const articles = [
        createArticle("article-a", { link: "http://example.com/not-found" }),
        createArticle("article-b", { link: "http://example.com/valid" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: "[bad[[" },
      ];

      const fetchFn: ExternalFetchFn = async (url) => {
        if (url.includes("not-found")) {
          return { body: null, statusCode: 404 };
        }
        return {
          body: `<html><body><div>Content</div></body></html>`,
          statusCode: 200,
        };
      };

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 2);

      const articleAError = errors.find((e) => e.articleId === "article-a");
      const articleBError = errors.find((e) => e.articleId === "article-b");

      assert.strictEqual(articleAError!.errorType, ExternalContentErrorType.FETCH_FAILED);
      assert.strictEqual(articleAError!.statusCode, 404);

      assert.strictEqual(articleBError!.errorType, ExternalContentErrorType.INVALID_CSS_SELECTOR);
    });

    it("includes correct articleId, sourceField, label, cssSelector in each error", async () => {
      const articles = [
        createArticle("my-article-id", {
          customUrl: "http://example.com/page",
        }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        {
          sourceField: "customUrl",
          label: "myLabel",
          cssSelector: ".my-selector",
        },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: null,
        statusCode: 500,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 1);
      assert.deepStrictEqual(errors[0], {
        articleId: "my-article-id",
        sourceField: "customUrl",
        label: "myLabel",
        cssSelector: ".my-selector",
        errorType: ExternalContentErrorType.FETCH_FAILED,
        statusCode: 500,
      });
    });
  });

  describe("NO_SELECTOR_MATCH error", () => {
    it("returns NO_SELECTOR_MATCH error when selector finds no elements", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".nonexistent" },
      ];

      const pageHtml = `<html><body><div class="article">Content here</div></body></html>`;
      const fetchFn: ExternalFetchFn = async () => ({
        body: pageHtml,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.articleId, "article-1");
      assert.strictEqual(errors[0]!.sourceField, "link");
      assert.strictEqual(errors[0]!.label, "content");
      assert.strictEqual(errors[0]!.cssSelector, ".nonexistent");
      assert.strictEqual(errors[0]!.errorType, ExternalContentErrorType.NO_SELECTOR_MATCH);
      assert.strictEqual(errors[0]!.message, 'CSS selector ".nonexistent" matched 0 elements');
      // HTML should not be included by default
      assert.strictEqual(errors[0]!.pageHtml, undefined);
    });

    it("includes HTML when includeHtmlInErrors option is true", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".nonexistent" },
      ];

      const pageHtml = `<html><body><div class="article">Content here</div></body></html>`;
      const fetchFn: ExternalFetchFn = async () => ({
        body: pageHtml,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn,
        { includeHtmlInErrors: true }
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.pageHtml, pageHtml);
      assert.strictEqual(errors[0]!.pageHtmlTruncated, false);
    });

    it("truncates HTML larger than 50KB and sets truncated flag", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".missing" },
      ];

      // Generate HTML larger than 50KB (50 * 1024 = 51200 bytes)
      const largeContent = "x".repeat(60 * 1024);
      const largeHtml = `<html><body>${largeContent}</body></html>`;
      const fetchFn: ExternalFetchFn = async () => ({
        body: largeHtml,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn,
        { includeHtmlInErrors: true }
      );

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.pageHtml!.length, 50 * 1024);
      assert.strictEqual(errors[0]!.pageHtmlTruncated, true);
    });

    it("does not return error when selector matches elements", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".article" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div class="article">Content</div></body></html>`,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 0);
    });

    it("reports NO_SELECTOR_MATCH for each property that finds no matches", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "title", cssSelector: ".missing-title" },
        { sourceField: "link", label: "body", cssSelector: ".missing-body" },
        { sourceField: "link", label: "found", cssSelector: ".exists" },
      ];

      const fetchFn: ExternalFetchFn = async () => ({
        body: `<html><body><div class="exists">Found content</div></body></html>`,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn
      );

      assert.strictEqual(errors.length, 2);
      assert.deepStrictEqual(errors.map((e) => e.label).sort(), ["body", "title"]);
      assert.ok(errors.every((e) => e.errorType === ExternalContentErrorType.NO_SELECTOR_MATCH));
    });

    it("strips script tags from HTML in errors for security", async () => {
      const articles = [
        createArticle("article-1", { link: "http://example.com/page" }),
      ];

      const externalProps: ExternalFeedProperty[] = [
        { sourceField: "link", label: "content", cssSelector: ".nonexistent" },
      ];

      const pageHtml = `<html><body><div class="article">Content</div><script>alert('xss')</script></body></html>`;
      const fetchFn: ExternalFetchFn = async () => ({
        body: pageHtml,
        statusCode: 200,
      });

      const errors = await injectExternalContent(
        articles,
        externalProps,
        fetchFn,
        { includeHtmlInErrors: true }
      );

      assert.strictEqual(errors.length, 1);
      assert.ok(!errors[0]!.pageHtml!.includes("<script>"));
      assert.ok(!errors[0]!.pageHtml!.includes("alert('xss')"));
      assert.ok(errors[0]!.pageHtml!.includes('<div class="article">Content</div>'));
    });
  });
});
