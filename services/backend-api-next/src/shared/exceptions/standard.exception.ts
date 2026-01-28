export class StandardException extends Error {
  subErrors: StandardException[];

  constructor(
    message?: string | StandardException[],
    options?: {
      subErrors?: StandardException[];
    }
  ) {
    if (typeof message === "string") {
      super(message);
      this.subErrors = options?.subErrors ?? [];
    } else if (Array.isArray(message)) {
      const subErrorMessages = message
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ");
      super(subErrorMessages || "Multiple errors occurred");
      this.subErrors = message;
    } else {
      super();
      this.subErrors = options?.subErrors ?? [];
    }
  }
}
