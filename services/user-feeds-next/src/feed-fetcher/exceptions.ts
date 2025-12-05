export class FeedRequestInternalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestInternalException";
  }
}

export class FeedRequestParseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestParseException";
  }
}

export class FeedRequestServerStatusException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestServerStatusException";
  }
}

export class FeedRequestNetworkException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestNetworkException";
  }
}

export class FeedRequestFetchException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestFetchException";
  }
}

export class FeedRequestBadStatusCodeException extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "FeedRequestBadStatusCodeException";
  }
}

export class FeedRequestTimedOutException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedRequestTimedOutException";
  }
}
