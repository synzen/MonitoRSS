import { StandardException } from "../../../common/exceptions";

export class ManualRequestTooSoonException extends StandardException {
  secondsUntilNextRequest: number;

  constructor(
    message: string,
    { secondsUntilNextRequest }: { secondsUntilNextRequest: number }
  ) {
    super(message);
    this.secondsUntilNextRequest = secondsUntilNextRequest;
  }
}
