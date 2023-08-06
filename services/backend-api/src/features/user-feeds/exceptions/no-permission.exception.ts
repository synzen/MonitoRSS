import { StandardException } from "../../../common/exceptions";

export class NoPermissionException extends StandardException {
  message = "You do not have permission to perform this action.";
}
