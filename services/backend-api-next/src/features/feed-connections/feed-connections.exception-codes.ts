import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const CREATE_CONNECTION_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  MissingDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  MissingChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  DiscordChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  UserMissingManageGuildException: {
    status: 403,
    code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
  },
  MissingChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  InvalidDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.DISCORD_CAHNNEL_INVALID,
  },
  WebhookMissingPermissionsException: {
    status: 403,
    code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
  },
  InsufficientSupporterLevelException: {
    status: 400,
    code: ApiErrorCode.INSUFFICIENT_SUPPORTER_LEVEL,
  },
  DiscordChannelMissingViewPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_VIEW_CHANNEL_PERMISSION,
  },
  InvalidComponentsV2Exception: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
};
