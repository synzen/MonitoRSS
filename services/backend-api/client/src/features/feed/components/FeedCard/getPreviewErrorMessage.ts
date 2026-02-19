import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";
import { getCuratedFeedErrorMessage } from "./getCuratedFeedErrorMessage";

function mapPreviewStatusToErrorCode(
  requestStatus?: string,
  responseStatusCode?: number
): string | undefined {
  if (!requestStatus) {
    return undefined;
  }

  if (requestStatus === "PARSE_ERROR") {
    return ApiErrorCode.ADD_FEED_PARSE_FAILED;
  }

  if (requestStatus === "TIMED_OUT" || requestStatus === "FETCH_TIMEOUT") {
    return ApiErrorCode.FEED_REQUEST_TIMEOUT;
  }

  if (requestStatus === "FETCH_ERROR") {
    return ApiErrorCode.FEED_FETCH_FAILED;
  }

  if (requestStatus === "INVALID_SSL_CERTIFICATE") {
    return ApiErrorCode.FEED_INVALID_SSL_CERT;
  }

  if (requestStatus === "BAD_STATUS_CODE" && responseStatusCode) {
    if (responseStatusCode === 403) return ApiErrorCode.FEED_REQUEST_FORBIDDEN;
    if (responseStatusCode === 401) return ApiErrorCode.FEED_REQUEST_UNAUTHORIZED;
    if (responseStatusCode === 404) return ApiErrorCode.FEED_NOT_FOUND;
    if (responseStatusCode === 429) return ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS;
    if (responseStatusCode >= 500) return ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR;
  }

  return undefined;
}

export function getPreviewErrorMessage(
  requestStatus?: string,
  responseStatusCode?: number
): string {
  const errorCode = mapPreviewStatusToErrorCode(requestStatus, responseStatusCode);

  if (!errorCode) {
    return "Couldn't load preview. Try again later.";
  }

  return getCuratedFeedErrorMessage(errorCode);
}
