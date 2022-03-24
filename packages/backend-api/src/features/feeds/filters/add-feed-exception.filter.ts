import { Catch, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/constants/api-errors';
import { StandardBaseExceptionFilter } from '../../../common/filters/standard-exception-filter';
import {
  AddFeedException,
  BannedFeedException,
  FeedLimitReachedException,
  MissingChannelException,
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from '../exceptions';

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [MissingChannelException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL,
    },
    [MissingChannelPermissionsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
    },
    [FeedLimitReachedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_LIMIT_REACHED,
    },
    [BannedFeedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID,
    },
    [UserMissingManageGuildException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
    },
  };

@Catch(AddFeedException)
export class AddFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
