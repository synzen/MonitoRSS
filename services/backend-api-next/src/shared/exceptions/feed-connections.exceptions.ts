import { StandardException } from "./standard.exception";

export class MissingDiscordChannelException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Discord channel not found");
  }
}

export class DiscordChannelPermissionsException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Missing permissions to access this Discord channel");
  }
}

export class InvalidFilterExpressionException extends StandardException {
  constructor(
    message?: string | StandardException[],
    options?: {
      subErrors?: StandardException[];
    },
  ) {
    if (typeof message === "string") {
      super(message, options);
    } else if (Array.isArray(message)) {
      super(message);
    } else {
      super("Invalid filter expression", options);
    }
  }
}

export class InsufficientSupporterLevelException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Insufficient supporter level for this feature");
  }
}

export class DiscordWebhookNonexistentException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Discord webhook does not exist");
  }
}

export class DiscordWebhookInvalidTypeException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Invalid Discord webhook type");
  }
}

export class DiscordWebhookMissingUserPermException extends StandardException {
  constructor(message?: string) {
    super(
      message ?? "User does not have permission to manage this webhook's guild",
    );
  }
}

export class DiscordChannelMissingViewPermissionsException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Bot cannot view this channel");
  }
}

export class InvalidDiscordChannelException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Invalid Discord channel type");
  }
}

export class FeedConnectionNotFoundException extends StandardException {
  constructor(message?: string) {
    super(message ?? "Feed connection not found");
  }
}
