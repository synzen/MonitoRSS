import { describe, it } from "node:test";
import assert from "node:assert";
import { tryGetRedditRssUrl } from "./articles.service";

describe("tryGetRedditRssUrl", () => {
  it("appends .rss to bare subreddit URLs", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://www.reddit.com/r/russian_memes_only"),
      "https://www.reddit.com/r/russian_memes_only.rss",
    );
  });

  it("strips trailing slash before appending .rss", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://www.reddit.com/r/foo/"),
      "https://www.reddit.com/r/foo.rss",
    );
  });

  it("appends .rss to subreddit sort URLs (e.g. /top, /new)", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://www.reddit.com/r/foo/top"),
      "https://www.reddit.com/r/foo/top.rss",
    );
  });

  it("returns null when URL already ends in .rss", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://www.reddit.com/r/foo.rss"),
      null,
    );
  });

  it("normalizes oauth.reddit.com URLs and preserves the oauth host", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://oauth.reddit.com/r/foo"),
      "https://oauth.reddit.com/r/foo.rss",
    );
  });

  it("normalizes old.reddit.com URLs and preserves the host", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://old.reddit.com/r/foo"),
      "https://old.reddit.com/r/foo.rss",
    );
  });

  it("preserves bare reddit.com host (does not force www)", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://reddit.com/r/foo"),
      "https://reddit.com/r/foo.rss",
    );
  });

  it("preserves the query string", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://www.reddit.com/r/foo?limit=10"),
      "https://www.reddit.com/r/foo.rss?limit=10",
    );
  });

  it("returns null for non-reddit hosts", () => {
    assert.strictEqual(tryGetRedditRssUrl("https://example.com/r/foo"), null);
  });

  it("returns null for unsupported reddit subdomains", () => {
    assert.strictEqual(
      tryGetRedditRssUrl("https://mod.reddit.com/r/foo"),
      null,
    );
  });

  it("returns null for invalid URLs", () => {
    assert.strictEqual(tryGetRedditRssUrl("not a url"), null);
  });
});
