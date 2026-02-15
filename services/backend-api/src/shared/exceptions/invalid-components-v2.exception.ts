import { StandardException } from "./standard.exception";

export class InvalidComponentsV2Exception extends StandardException {
  path?: (string | number)[];

  constructor(
    messageOrSubErrors?: string | InvalidComponentsV2Exception[],
    path?: (string | number)[],
  ) {
    if (typeof messageOrSubErrors === "string") {
      super(`${path?.join(".")}: ${messageOrSubErrors}`.trim());
    } else if (Array.isArray(messageOrSubErrors)) {
      super("Invalid componentsV2 configuration", {
        subErrors: messageOrSubErrors,
      });
    } else {
      super("Invalid componentsV2 configuration");
    }

    this.path = path;
  }
}
