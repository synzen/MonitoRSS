export class DiscordAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiscordAPIError);
    }
  }
}
