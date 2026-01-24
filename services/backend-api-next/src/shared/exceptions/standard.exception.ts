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
    } else {
      super();
    }

    this.subErrors = options?.subErrors ?? [];
  }
}
