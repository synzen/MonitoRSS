import { StandardException } from "../../../common/exceptions";

export class AddressLocationNotAllowedException extends StandardException {
  message = "Your location is not supported for billing.";
}
