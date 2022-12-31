import { StandardException } from "./standard-exception.exception";

export class CannotEnableAutoDisabledConnection extends StandardException {
  message = "Cannot enable connection that was automatically disabled";
}
