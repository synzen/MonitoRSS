import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import {
  CannotEnableAutoDisabledConnection,
  DiscordWebhookInvalidTypeException,
  DiscordWebhookNonexistentException,
  InvalidFilterExpressionException,
} from "../../../common/exceptions";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [DiscordWebhookNonexistentException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.WEBHOOK_MISSING,
    },
    [DiscordWebhookInvalidTypeException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.WEBHOOK_INVALID,
    },
    [InvalidFilterExpressionException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID_FILTER_EXPRESSION,
    },
    [CannotEnableAutoDisabledConnection.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED,
    },
  };

@Catch(StandardException)
export class UpdateDiscordWebhookConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
