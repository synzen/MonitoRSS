import { StandardException } from "../../../common/exceptions";

export class TransactionBalanceTooLowException extends StandardException {
  message = "Transaction balance is less than minimum required.";
}
