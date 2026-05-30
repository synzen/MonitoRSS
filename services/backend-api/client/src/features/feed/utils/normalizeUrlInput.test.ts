import { describe, it, expect } from "vitest";
import { parseSearchInputAsUrl, ensureUrlScheme } from "./normalizeUrlInput";

describe("parseSearchInputAsUrl", () => {
  it("treats input with an http(s) scheme as a URL, unchanged", () => {
    expect(parseSearchInputAsUrl("https://example.com/feed")).toEqual({
      isUrl: true,
      url: "https://example.com/feed",
    });
    expect(parseSearchInputAsUrl("http://example.com/feed")).toEqual({
      isUrl: true,
      url: "http://example.com/feed",
    });
  });

  it("treats a scheme-less host with a path as a URL and prepends https://", () => {
    expect(parseSearchInputAsUrl("www.youtube.com/@channel")).toEqual({
      isUrl: true,
      url: "https://www.youtube.com/@channel",
    });
    expect(parseSearchInputAsUrl("youtu.be/abc123")).toEqual({
      isUrl: true,
      url: "https://youtu.be/abc123",
    });
    expect(parseSearchInputAsUrl("www.reddit.com/r/SubredditName")).toEqual({
      isUrl: true,
      url: "https://www.reddit.com/r/SubredditName",
    });
  });

  it("treats a bare host with no path as a search term, not a URL", () => {
    expect(parseSearchInputAsUrl("example.com")).toEqual({
      isUrl: false,
      url: "example.com",
    });
  });

  it("treats plain search keywords as search terms", () => {
    expect(parseSearchInputAsUrl("youtube")).toEqual({ isUrl: false, url: "youtube" });
    expect(parseSearchInputAsUrl("the hacker news")).toEqual({
      isUrl: false,
      url: "the hacker news",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseSearchInputAsUrl("  www.youtube.com/@channel  ")).toEqual({
      isUrl: true,
      url: "https://www.youtube.com/@channel",
    });
  });
});

describe("ensureUrlScheme", () => {
  it("leaves URLs that already have a scheme unchanged", () => {
    expect(ensureUrlScheme("https://example.com/feed")).toBe("https://example.com/feed");
    expect(ensureUrlScheme("http://example.com/feed")).toBe("http://example.com/feed");
  });

  it("prepends https:// to a scheme-less host, with or without a path", () => {
    expect(ensureUrlScheme("www.youtube.com/@channel")).toBe("https://www.youtube.com/@channel");
    expect(ensureUrlScheme("example.com")).toBe("https://example.com");
  });

  it("leaves non-URL-like input unchanged for the caller to reject", () => {
    expect(ensureUrlScheme("not a url")).toBe("not a url");
    expect(ensureUrlScheme("justtext")).toBe("justtext");
  });

  it("trims surrounding whitespace", () => {
    expect(ensureUrlScheme("  example.com/feed  ")).toBe("https://example.com/feed");
  });
});
