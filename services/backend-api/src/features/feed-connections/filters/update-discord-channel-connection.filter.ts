import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import {
  CannotEnableAutoDisabledConnection,
  InsufficientSupporterLevelException,
  InvalidComponentsV2Exception,
  InvalidFilterExpressionException,
} from "../../../common/exceptions";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { WebhookMissingPermissionsException } from "../../discord-webhooks/exceptions";
import {
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from "../../feeds/exceptions";
import {
  DiscordChannelPermissionsException,
  FeedConnectionNotFoundException,
  MissingDiscordChannelException,
} from "../exceptions";
import { DiscordChannelMissingViewPermissionsException } from "../exceptions/discord-channel-missing-view-permissions.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [FeedConnectionNotFoundException.name]: {
      status: HttpStatus.NOT_FOUND,
      code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
    },
    [MissingDiscordChannelException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL,
    },
    [DiscordChannelPermissionsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
    },
    [UserMissingManageGuildException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
    },
    [InvalidFilterExpressionException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID_FILTER_EXPRESSION,
    },
    [InvalidComponentsV2Exception.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
    },
    [CannotEnableAutoDisabledConnection.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED,
    },
    [MissingChannelPermissionsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
    },
    [InsufficientSupporterLevelException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.INSUFFICIENT_SUPPORTER_LEVEL,
    },
    [WebhookMissingPermissionsException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
    },
    [DiscordChannelMissingViewPermissionsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_VIEW_CHANNEL_PERMISSION,
    },
    [InvalidComponentsV2Exception.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
    },
  };

@Catch(StandardException)
export class UpdateDiscordChannelConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
