/**
 * Exception thrown when regex evaluation fails in custom placeholders or filters.
 * Matches user-feeds RegexEvalException for behavioral parity.
 */
export class RegexEvalException extends Error {
  regexErrors?: Error[];

  constructor(
    message: string,
    options?: {
      regexErrors: Error[];
    }
  ) {
    super(message);
    this.name = "RegexEvalException";
    this.regexErrors = options?.regexErrors;
  }
}

/**
 * Exception thrown specifically for custom placeholder regex evaluation failures.
 * Extends RegexEvalException for type discrimination in catch blocks.
 */
export class CustomPlaceholderRegexEvalException extends RegexEvalException {
  constructor(
    message: string,
    options?: {
      regexErrors: Error[];
    }
  ) {
    super(message, options);
    this.name = "CustomPlaceholderRegexEvalException";
  }
}
