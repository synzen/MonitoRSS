import { UserFeedArticleRequestStatus } from '../types';

export const getErrorMessageForArticleRequestStatus = (
  status: UserFeedArticleRequestStatus,
  statusCode?: number,
) => {
  if (status === UserFeedArticleRequestStatus.ParseError) {
    return 'common.apiErrors.feedParseFailed';
  }

  if (status === UserFeedArticleRequestStatus.BadStatusCode) {
    if (statusCode === 403) {
      return 'common.apiErrors.feedRequestForbidden';
    }

    if (statusCode === 401) {
      return 'common.apiErrors.feedRequestUnauthorized';
    }

    if (statusCode === 429) {
      return 'common.apiErrors.feedRequestTooManyRequests';
    }

    if (statusCode?.toString().startsWith('5')) {
      return 'common.apiErrors.feedRequestInternalError';
    }

    return 'common.apiErrors.feedRequestFailed';
  }

  return 'common.apiErrors.feedRequestFailed';
};
