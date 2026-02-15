import { StandardException } from "./standard.exception";

export class UserManagerAlreadyInvitedException extends StandardException {}
export class UserFeedTransferRequestExistsException extends StandardException {}
export class InviteNotFoundException extends StandardException {}
export class InvalidConnectionIdException extends StandardException {}

// Backward compatibility alias for the typo in the original exception name
export const UserFeedTransferRequestExiststException =
  UserFeedTransferRequestExistsException;
