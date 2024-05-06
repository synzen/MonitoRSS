export class InvalidFeedException extends Error {
  redirectedFromHtml: boolean;

  constructor(
    message?: string,
    private readonly data?: {
      redirectedFromHtml?: boolean;
    }
  ) {
    super(message);

    this.redirectedFromHtml = data?.redirectedFromHtml || false;
  }
}
