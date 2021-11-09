class RequestError extends Error {
  constructor(public code: number | null, message: string) {
    super(message);
    Error.captureStackTrace(this, RequestError);
  }

  static CODES = {
    BAD_RESPONSE_CODE: 50042,
    BLOCKED_BY_CLOUDFLARE: 50043,
    TIMEOUT: 50044,
  };

  /**
   * Used when the the request was successful but the server responded with a non-200 status code.
   * 
   * @param message The user-friendly error message.
   * @returns The RequestError instance.
   */
  static BadStatusCode(message: string) {
    return new RequestError(this.CODES.BAD_RESPONSE_CODE, message);
  }

  /**
   * Used when the request was successful but the server responded with a non-200 status code, and
   * the server response headers includes cloudflare.
   * 
   * @param message The user-friendly error message.
   * @returns The RequestError instance.
   */
  static Cloudflare(message = 'The server has blocked the request via Cloudflare.') {
    return new RequestError(this.CODES.BLOCKED_BY_CLOUDFLARE, message);
  }

  /**
   * Used when the request has taken too long to complete.
   * 
   * @param message The user-friendly error message.
   * @returns The RequestError instance.
   */
  static TimedOut(message: string = 'The request took too long and timed out.') {
    return new RequestError(this.CODES.TIMEOUT, message);
  }

  isCloudflare() {
    return this.code === RequestError.CODES.BLOCKED_BY_CLOUDFLARE;
  }
}

export default RequestError;
