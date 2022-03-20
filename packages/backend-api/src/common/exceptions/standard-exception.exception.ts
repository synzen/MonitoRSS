export class StandardException extends Error {
  subErrors: StandardException[];

  constructor(message?: string | StandardException[]) {
    if (typeof message === 'string') {
      super(message);
    } else {
      super();
    }

    if (Array.isArray(message)) {
      this.subErrors = message;
    } else {
      this.subErrors = [];
    }
  }
}
