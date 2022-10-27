import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { DiscordChannelNotOwnedException } from "../../../common/exceptions";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { UserMissingManageGuildException } from "../../feeds/exceptions";
import {
  DiscordChannelPermissionsException,
  FeedConnectionNotFoundException,
  MissingDiscordChannelException,
} from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [FeedConnectionNotFoundException.name]: {
      status: HttpStatus.NOT_FOUND,
      code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
    },
    [DiscordChannelNotOwnedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.DISCORD_CHANNEL_NOT_OWNED_BY_GUILD,
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
  };

@Catch(StandardException)
export class UpdateDiscordChannelConnectionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
