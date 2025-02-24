import { UserFeedArticleRequestStatus } from "../types";

export const getErrorMessageForArticleRequestStatus = (
  status: UserFeedArticleRequestStatus,
  statusCode?: number
) => {
  if (status === UserFeedArticleRequestStatus.ParseError) {
    return {
      ref: "common.apiErrors.feedParseFailed",
    };
  }

  if (status === UserFeedArticleRequestStatus.TimedOut) {
    return {
      ref: "common.apiErrors.feedRequestTimeout",
    };
  }

  if (status === UserFeedArticleRequestStatus.Pending) {
    return {
      ref: "common.apiErrors.feedRequestPendingArticles",
      status: "info" as const,
    };
  }

  if (status === UserFeedArticleRequestStatus.BadStatusCode) {
    if (statusCode === 403) {
      return {
        ref: "common.apiErrors.feedRequestForbidden",
      };
    }

    if (statusCode === 401) {
      return {
        ref: "common.apiErrors.feedRequestUnauthorized",
      };
    }

    if (statusCode === 429) {
      return {
        ref: "common.apiErrors.feedRequestTooManyRequests",
      };
    }

    if (statusCode === 404) {
      return {
        ref: "common.apiErrors.feedRequestNotFound",
      };
    }

    if (statusCode?.toString().startsWith("5")) {
      return {
        ref: "common.apiErrors.feedRequestInternalError",
      };
    }

    return {
      ref: "common.apiErrors.feedRequestFailed",
    };
  }

  return {
    ref: "common.apiErrors.feedRequestFailed",
  };
};
