import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import {
  InvalidFiltersRegexException,
  InvalidPreviewCustomPlaceholdersRegexException,
} from "../../../services/feed-fetcher/exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [InvalidPreviewCustomPlaceholdersRegexException.name]: {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT,
    },
    [InvalidFiltersRegexException.name]: {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.INVALID_FILTERS_REGEX,
    },
  };

@Catch(StandardException)
export class GetUserFeedArticlesExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
