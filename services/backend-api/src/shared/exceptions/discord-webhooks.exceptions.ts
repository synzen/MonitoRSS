import { StandardException } from "./standard.exception";

export class WebhookMissingPermissionsException extends StandardException {
  constructor() {
    super("Missing permissions to access webhooks in this channel");
  }
}
