import { BadRequestError, ConflictError } from "../../infra/error-handler";
import { ApiErrorCode } from "../../shared/constants/api-errors";
import {
  UserFeedTagLimitReachedError,
  WorkspaceTagInvalidAssignmentError,
  WorkspaceTagLimitReachedError,
  WorkspaceTagNameInvalidError,
  WorkspaceTagNameTakenError,
  WorkspaceTagsPersonalFeedUnsupportedError,
} from "./workspace-tags.errors";

export function toWorkspaceTagHttpError(error: unknown): Error {
  if (error instanceof WorkspaceTagNameInvalidError) {
    return new BadRequestError(ApiErrorCode.WORKSPACE_TAG_NAME_INVALID);
  }

  if (error instanceof WorkspaceTagNameTakenError) {
    return new ConflictError(ApiErrorCode.WORKSPACE_TAG_NAME_TAKEN);
  }

  if (error instanceof WorkspaceTagLimitReachedError) {
    return new ConflictError(ApiErrorCode.WORKSPACE_TAG_LIMIT_REACHED);
  }

  if (error instanceof WorkspaceTagInvalidAssignmentError) {
    return new BadRequestError(ApiErrorCode.WORKSPACE_TAG_INVALID_ASSIGNMENT);
  }

  if (error instanceof WorkspaceTagsPersonalFeedUnsupportedError) {
    return new BadRequestError(
      ApiErrorCode.WORKSPACE_TAGS_PERSONAL_FEED_UNSUPPORTED,
    );
  }

  if (error instanceof UserFeedTagLimitReachedError) {
    return new BadRequestError(ApiErrorCode.USER_FEED_TAG_LIMIT_REACHED);
  }

  return error instanceof Error
    ? error
    : new Error("Unknown workspace tag error");
}
