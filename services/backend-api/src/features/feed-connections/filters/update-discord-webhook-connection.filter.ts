import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookNonexistentException,
  DiscordWebhookNotOwnedException,
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
    [DiscordWebhookNotOwnedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.WEBHOOK_MISSING,
    },
  };

@Catch(StandardException)
export class UpdateDiscordWebhookConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
