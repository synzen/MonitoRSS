import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
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
    [DiscordWebhookMissingUserPermException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
    },
  };

@Catch(StandardException)
export class AddDiscordWebhookConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
