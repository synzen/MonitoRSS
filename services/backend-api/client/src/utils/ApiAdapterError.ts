interface ErrorDetails {
  statusCode?: number;
  errorCode?: string;
  body?: Record<string, any>;
}

class ApiAdapterError extends Error {
  statusCode?: number;

  errorCode?: string;

  body?: Record<string, any>;

  constructor(message: string, details?: ErrorDetails) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message);

    this.statusCode = details?.statusCode;
    this.errorCode = details?.errorCode;
    this.body = details?.body;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiAdapterError;
