import i18n from './i18n';

const { t } = i18n;

const ERROR_CODE_MESSAGES: Record<string, string> = {
  INVALID_FEED: t('common.apiErrors.invalidFeed'),
  PARSE_FAILED: t('common.apiErrors.parseFailed'),
  PARSE_TIMEOUUT: t('common.apiErrors.parseTimeout'),
  REQUEST_TIMEOUT: t('common.apiErrors.requestTimeout'),
  REQUEST_FAILED: t('common.apiErrors.requestFailed'),
};

export const getStandardErrorCodeMessage = (code: string) => {
  const mappedError = ERROR_CODE_MESSAGES[code];

  if (!mappedError) {
    return t('common.errors.somethingWentWrong');
  }

  return mappedError;
};
