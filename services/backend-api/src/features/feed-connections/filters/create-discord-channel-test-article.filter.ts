import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { InvalidComponentsV2Exception } from "../../../common/exceptions";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import {
  FeedArticleNotFoundException,
  InvalidFiltersRegexException,
  InvalidPreviewCustomPlaceholdersRegexException,
} from "../../../services/feed-fetcher/exceptions";
import { MissingChannelException } from "../../feeds/exceptions";
import { FeedConnectionNotFoundException } from "../exceptions";

export const CREATE_DISCORD_CHANNEL_TEST_ARTICLE_ERROR_CODES: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
  [FeedConnectionNotFoundException.name]: {
    status: HttpStatus.NOT_FOUND,
    code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
  },
  [FeedArticleNotFoundException.name]: {
    status: HttpStatus.NOT_FOUND,
    code: ApiErrorCode.FEED_ARTICLE_NOT_FOUND,
  },
  [InvalidPreviewCustomPlaceholdersRegexException.name]: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT,
  },
  [InvalidFiltersRegexException.name]: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ApiErrorCode.INVALID_FILTERS_REGEX,
  },
  [InvalidComponentsV2Exception.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
  [MissingChannelException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
};

@Catch(StandardException)
export class CreateDiscordChannelTestArticleFilter extends StandardBaseExceptionFilter {
  exceptions = CREATE_DISCORD_CHANNEL_TEST_ARTICLE_ERROR_CODES;
}
