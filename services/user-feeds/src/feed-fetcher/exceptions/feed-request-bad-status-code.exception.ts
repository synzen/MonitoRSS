export class FeedRequestBadStatusCodeException extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}
