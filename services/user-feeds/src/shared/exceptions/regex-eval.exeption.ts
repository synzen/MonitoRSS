export class RegexEvalException extends Error {
  regexErrors?: Error[];

  constructor(
    message: string,
    options?: {
      regexErrors: Error[];
    }
  ) {
    super(message);
    this.regexErrors = options?.regexErrors;
  }
}
