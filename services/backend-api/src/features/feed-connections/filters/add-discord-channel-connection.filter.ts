import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { InsufficientSupporterLevelException } from "../../../common/exceptions";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { WebhookMissingPermissionsException } from "../../discord-webhooks/exceptions";
import {
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from "../../feeds/exceptions";
import {
  DiscordChannelPermissionsException,
  InvalidDiscordChannelException,
  MissingDiscordChannelException,
} from "../exceptions";
import { DiscordChannelMissingViewPermissionsException } from "../exceptions/discord-channel-missing-view-permissions.exception";

export const ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
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
  [MissingChannelPermissionsException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  [InvalidDiscordChannelException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.DISCORD_CAHNNEL_INVALID,
  },
  [WebhookMissingPermissionsException.name]: {
    status: HttpStatus.FORBIDDEN,
    code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
  },
  [InsufficientSupporterLevelException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.INSUFFICIENT_SUPPORTER_LEVEL,
  },
  [DiscordChannelMissingViewPermissionsException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_MISSING_VIEW_CHANNEL_PERMISSION,
  },
};

@Catch(StandardException)
export class AddDiscordChannelConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES;
}
