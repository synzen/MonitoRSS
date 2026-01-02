import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES } from "../../feed-connections/filters/add-discord-channel-connection.filter";
import { CREATE_DISCORD_CHANNEL_TEST_ARTICLE_ERROR_CODES } from "../../feed-connections/filters/create-discord-channel-test-article.filter";

export const SEND_TEST_ARTICLE_ERROR_CODES: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
  ...CREATE_DISCORD_CHANNEL_TEST_ARTICLE_ERROR_CODES,
  ...ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES,
};

@Catch(StandardException)
export class SendTestArticleFilter extends StandardBaseExceptionFilter {
  exceptions = SEND_TEST_ARTICLE_ERROR_CODES;
}
