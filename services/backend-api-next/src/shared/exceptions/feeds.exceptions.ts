import { StandardException } from "./standard.exception";

export class MissingChannelException extends StandardException {}
export class MissingChannelPermissionsException extends StandardException {}
export class UserMissingManageGuildException extends StandardException {}
