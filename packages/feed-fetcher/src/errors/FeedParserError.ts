class FeedParserError extends Error {
  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, FeedParserError);
  }

  /**
   * Used when a feed is invalid. An example may be bad XML markup.
   *
   * @param message User-friendly error message
   * @returns An instance of FeedParserError
   */
  static InvalidFeed(message: string = `That is a not a valid feed. Note that you cannot add just
    any link. You may check if it is a valid feed by using online RSS feed validators`,
  ) {
    return new FeedParserError(message);
  }
}

export default FeedParserError;
