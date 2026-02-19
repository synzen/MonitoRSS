import { describe, it, expect } from "vitest";
import { getCuratedFeedErrorMessage } from "./getCuratedFeedErrorMessage";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";

describe("getCuratedFeedErrorMessage", () => {
  describe("Bucket 1 — Transient (try again later)", () => {
    const transientCodes = [
      ApiErrorCode.FEED_REQUEST_TIMEOUT,
      ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR,
      ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
      ApiErrorCode.FEED_FETCH_FAILED,
      ApiErrorCode.FEED_INVALID_SSL_CERT,
      ApiErrorCode.INTERNAL_ERROR,
    ];

    it.each(transientCodes)("returns transient message for %s", (code) => {
      expect(getCuratedFeedErrorMessage(code)).toBe(
        "This feed can't be reached right now. Try again later.",
      );
    });
  });

  describe("Bucket 2 — Unavailable (try a different feed)", () => {
    const unavailableCodes = [
      ApiErrorCode.FEED_NOT_FOUND,
      ApiErrorCode.FEED_REQUEST_FORBIDDEN,
      ApiErrorCode.FEED_REQUEST_UNAUTHORIZED,
      ApiErrorCode.BANNED_FEED,
    ];

    it.each(unavailableCodes)("returns unavailable message for %s", (code) => {
      expect(getCuratedFeedErrorMessage(code)).toBe(
        "This feed is no longer available. Try a different feed.",
      );
    });
  });

  describe("Bucket 3 — Broken feed (try a different feed)", () => {
    const brokenCodes = [
      ApiErrorCode.ADD_FEED_PARSE_FAILED,
      ApiErrorCode.NO_FEED_IN_HTML_PAGE,
      ApiErrorCode.FEED_TOO_LARGE,
    ];

    it.each(brokenCodes)("returns broken message for %s", (code) => {
      expect(getCuratedFeedErrorMessage(code)).toBe(
        "Something's wrong with this feed. Try a different feed.",
      );
    });
  });

  describe("Fallback", () => {
    it("returns transient message for unknown error code", () => {
      expect(getCuratedFeedErrorMessage("UNKNOWN_CODE")).toBe(
        "This feed can't be reached right now. Try again later.",
      );
    });

    it("returns transient message when errorCode is undefined", () => {
      expect(getCuratedFeedErrorMessage(undefined)).toBe(
        "This feed can't be reached right now. Try again later.",
      );
    });
  });
});
