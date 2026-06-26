import { describe, it, expect } from "vitest";
import { isRedditFeedUrl } from "./isRedditFeedUrl";

describe("isRedditFeedUrl", () => {
  it("detects a plain reddit.com url", () => {
    expect(isRedditFeedUrl("https://reddit.com/r/rss/.rss")).toBe(true);
  });

  it("detects www and other reddit subdomains", () => {
    expect(isRedditFeedUrl("https://www.reddit.com/r/rss/.rss")).toBe(true);
    expect(isRedditFeedUrl("https://old.reddit.com/r/rss/.rss")).toBe(true);
  });

  it("rejects non-reddit urls", () => {
    expect(isRedditFeedUrl("https://example.com/feed.xml")).toBe(false);
    expect(isRedditFeedUrl("https://hnrss.org/frontpage")).toBe(false);
  });

  it("does not match a lookalike host that merely contains reddit.com", () => {
    expect(isRedditFeedUrl("https://reddit.com.evil.example/feed")).toBe(false);
    expect(isRedditFeedUrl("https://notreddit.com/feed")).toBe(false);
  });

  it("returns false for an unparseable url", () => {
    expect(isRedditFeedUrl("not a url")).toBe(false);
    expect(isRedditFeedUrl("")).toBe(false);
  });
});
