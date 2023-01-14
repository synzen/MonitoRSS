import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { FeedArticleNotFoundException } from "../../../services/feed-fetcher/exceptions";
import { FeedConnectionNotFoundException } from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [FeedConnectionNotFoundException.name]: {
      status: HttpStatus.NOT_FOUND,
      code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
    },
    [FeedArticleNotFoundException.name]: {
      status: HttpStatus.NOT_FOUND,
      code: ApiErrorCode.FEED_ARTICLE_NOT_FOUND,
    },
  };

@Catch(StandardException)
export class CreateDiscordChannelTestArticleFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
