import i18n from './i18n';

const { t } = i18n;

enum ApiErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  FEED_INVALID = 'FEED_INVALID',
  FEED_PARSE_FAILED = 'FEED_PARSE_FAILED',
  FEED_PARSE_TIMEOUT = 'FEED_PARSE_TIMEOUT',
  FEED_REQUEST_TIMEOUT = 'FEED_REQUEST_TIMEOUT',
  FEED_REQUEST_FAILED = 'FEED_REQUEST_FAILED',
  FEED_REQUEST_FORBIDDEN = 'FEED_REQUEST_FORBIDDEN',
  FEED_REQUEST_INTERNAL_ERROR = 'FEED_REQUEST_INTERNAL_ERROR',
  FEED_REQUEST_TOO_MANY_REQUESTS = 'FEED_REQUEST_TOO_MANY_REQUESTS',
  FEED_REQUEST_UNAUTHORIZED = 'FEED_REQUEST_UNAUTHORIZED',
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS = 'WEBHOOKS_MANAGE_MISSING_PERMISSIONS',
}

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  FEED_INVALID: t('common.apiErrors.feedInvalid'),
  FEED_PARSE_FAILED: t('common.apiErrors.feedParseFailed'),
  FEED_PARSE_TIMEOUT: t('common.apiErrors.feedParseTimeout'),
  FEED_REQUEST_TIMEOUT: t('common.apiErrors.feedRequestTimeout'),
  FEED_REQUEST_FAILED: t('common.apiErrors.feedRequestFailed'),
  FEED_REQUEST_FORBIDDEN: t('common.apiErrors.feedRequestForbidden'),
  FEED_REQUEST_INTERNAL_ERROR: t('common.apiErrors.feedRequestInternalError'),
  FEED_REQUEST_TOO_MANY_REQUESTS: t('common.apiErrors.feedRequestTooManyRequests'),
  FEED_REQUEST_UNAUTHORIZED: t('common.apiErrors.feedRequestUnauthorized'),
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS: t('common.apiErrors.webhooksManageMissingPermissions'),
  INTERNAL_ERROR: t('common.errors.somethingWentWrong'),
};

export const getStandardErrorCodeMessage = (code: ApiErrorCode) => {
  const mappedError = ERROR_CODE_MESSAGES[code];

  if (!mappedError) {
    return t('common.errors.somethingWentWrong');
  }

  return mappedError;
};
