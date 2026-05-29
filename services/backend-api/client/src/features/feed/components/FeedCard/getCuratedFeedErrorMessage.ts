import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";

const UNAVAILABLE_CODES = new Set<string>([
  ApiErrorCode.FEED_NOT_FOUND,
  ApiErrorCode.FEED_REQUEST_FORBIDDEN,
  ApiErrorCode.FEED_REQUEST_UNAUTHORIZED,
  ApiErrorCode.BANNED_FEED,
]);

const BROKEN_CODES = new Set<string>([
  ApiErrorCode.ADD_FEED_PARSE_FAILED,
  ApiErrorCode.NO_FEED_IN_HTML_PAGE,
  ApiErrorCode.FEED_TOO_LARGE,
]);

const MESSAGES = {
  transient: "This feed can't be reached right now. Try again later.",
  unavailable: "This feed is no longer available. Try a different feed.",
  broken: "Something's wrong with this feed. Try a different feed.",
} as const;

export function getCuratedFeedErrorMessage(errorCode?: string): string {
  if (errorCode && UNAVAILABLE_CODES.has(errorCode)) {
    return MESSAGES.unavailable;
  }

  if (errorCode && BROKEN_CODES.has(errorCode)) {
    return MESSAGES.broken;
  }

  return MESSAGES.transient;
}
