interface ErrorDetails {
  statusCode?: number;
}

class ApiAdapterError extends Error {
  statusCode?: number;

  constructor(message: string, details?: ErrorDetails) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message);

    this.statusCode = details?.statusCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiAdapterError;
