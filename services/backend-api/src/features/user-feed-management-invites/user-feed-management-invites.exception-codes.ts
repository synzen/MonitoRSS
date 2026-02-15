import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const CREATE_INVITE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  UserManagerAlreadyInvitedException: {
    status: 400,
    code: ApiErrorCode.USER_MANAGER_ALREADY_INVITED,
  },
  UserFeedTransferRequestExistsException: {
    status: 400,
    code: ApiErrorCode.USER_FEED_TRANSFER_REQUEST_EXISTS,
  },
};

export const UPDATE_INVITE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  InviteNotFoundException: {
    status: 404,
    code: ApiErrorCode.INVITE_NOT_FOUND,
  },
  FeedLimitReachedException: {
    status: 400,
    code: ApiErrorCode.FEED_LIMIT_REACHED,
  },
};

export const UPDATE_INVITE_STATUS_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  InviteNotFoundException: {
    status: 404,
    code: ApiErrorCode.INVITE_NOT_FOUND,
  },
  FeedLimitReachedException: {
    status: 400,
    code: ApiErrorCode.FEED_LIMIT_REACHED,
  },
};

export const RESEND_INVITE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  InviteNotFoundException: {
    status: 404,
    code: ApiErrorCode.INVITE_NOT_FOUND,
  },
};

export const DELETE_INVITE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  InviteNotFoundException: {
    status: 404,
    code: ApiErrorCode.INVITE_NOT_FOUND,
  },
};
