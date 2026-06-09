import { describe, it } from "node:test";
import assert from "node:assert";
import { isRedditFeedUrl } from "../../src/shared/utils/is-reddit-feed-url";

describe("isRedditFeedUrl", () => {
  it("matches subreddit URLs", () => {
    assert.strictEqual(
      isRedditFeedUrl("https://www.reddit.com/r/gaming/.rss"),
      true,
    );
    assert.strictEqual(isRedditFeedUrl("https://reddit.com/r/gaming"), true);
  });

  it("matches non-/r/ reddit URLs (user, multireddit)", () => {
    assert.strictEqual(
      isRedditFeedUrl("https://www.reddit.com/user/someone/.rss"),
      true,
    );
    assert.strictEqual(
      isRedditFeedUrl("https://www.reddit.com/user/someone/m/multi/.rss"),
      true,
    );
  });

  it("matches reddit subdomains (old, np)", () => {
    assert.strictEqual(isRedditFeedUrl("https://old.reddit.com/r/gaming"), true);
    assert.strictEqual(isRedditFeedUrl("https://np.reddit.com/r/gaming"), true);
  });

  it("is case-insensitive on hostname", () => {
    assert.strictEqual(isRedditFeedUrl("https://WWW.REDDIT.COM/r/gaming"), true);
  });

  it("rejects non-reddit hosts", () => {
    assert.strictEqual(isRedditFeedUrl("https://example.com/feed.xml"), false);
    assert.strictEqual(isRedditFeedUrl("https://www.youtube.com/@x"), false);
  });

  it("rejects hosts that merely contain reddit as a substring", () => {
    assert.strictEqual(isRedditFeedUrl("https://notreddit.com/r/x"), false);
    assert.strictEqual(
      isRedditFeedUrl("https://reddit.com.evil.com/r/x"),
      false,
    );
  });

  it("returns false for unparseable input", () => {
    assert.strictEqual(isRedditFeedUrl("not a url"), false);
    assert.strictEqual(isRedditFeedUrl(""), false);
  });
});
