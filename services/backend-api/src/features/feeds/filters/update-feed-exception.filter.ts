import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import {
  MissingChannelException,
  MissingChannelPermissionsException,
  WebhookInvalidException,
  WebhookMissingException,
  WebhooksDisabledException,
} from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [WebhooksDisabledException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.WEBHOOKS_DISABLED,
    },
    [WebhookMissingException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.WEBHOOK_MISSING,
    },
    [MissingChannelException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL,
    },
    [MissingChannelPermissionsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
    },
    [WebhookInvalidException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.WEBHOOK_INVALID,
    },
  };

@Catch(StandardException)
export class UpdateFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
