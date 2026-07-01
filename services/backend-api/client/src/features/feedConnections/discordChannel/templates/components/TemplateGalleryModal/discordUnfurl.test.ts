import { describe, it, expect } from "vitest";
import { messageMayUnfurl, previewMayUnfurl } from "./discordUnfurl";

// eslint-disable-next-line no-bitwise
const V2_FLAG = 1 << 15;

describe("messageMayUnfurl", () => {
  it("returns true for a plain-text message with a bare link (Simple Text)", () => {
    expect(messageMayUnfurl({ content: "**Title**\nhttps://example.com/article" })).toBe(true);
  });

  it("returns false when the link is wrapped in <> (unfurl suppressed)", () => {
    expect(messageMayUnfurl({ content: "**Title**\n<https://example.com/article>" })).toBe(false);
  });

  it("returns false when the link is markdown link syntax [text](url)", () => {
    expect(messageMayUnfurl({ content: "[Read more](https://example.com/article)" })).toBe(false);
  });

  it("returns false when there is no link at all", () => {
    expect(messageMayUnfurl({ content: "Just some text, no link." })).toBe(false);
  });

  it("returns false for a components-v2 message even if content has a link", () => {
    expect(messageMayUnfurl({ content: "https://example.com/article", flags: V2_FLAG })).toBe(
      false,
    );
  });

  it("returns false for empty / undefined content", () => {
    expect(messageMayUnfurl({ content: "" })).toBe(false);
    expect(messageMayUnfurl({ content: null })).toBe(false);
    expect(messageMayUnfurl(undefined)).toBe(false);
  });
});

describe("previewMayUnfurl", () => {
  it("is true if any message in the payload may unfurl", () => {
    expect(
      previewMayUnfurl([{ content: "no link here" }, { content: "https://example.com/article" }]),
    ).toBe(true);
  });

  it("is false for an all-v2 payload (Rich Embed / Compact Card / Media Gallery)", () => {
    expect(previewMayUnfurl([{ content: "irrelevant", flags: V2_FLAG }])).toBe(false);
  });

  it("is false for an empty payload", () => {
    expect(previewMayUnfurl([])).toBe(false);
  });
});
