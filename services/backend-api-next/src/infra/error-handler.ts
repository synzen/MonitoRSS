import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { getAccessTokenFromRequest } from "./auth";
import logger from "./logger";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
    this.name = "ConflictError";
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(422, message, details);
    this.name = "UnprocessableEntityError";
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = "Too Many Requests", public readonly retryAfter?: number) {
    super(429, message);
    this.name = "TooManyRequestsError";
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = "Service Unavailable") {
    super(503, message);
    this.name = "ServiceUnavailableError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Internal Server Error") {
    super(500, message);
    this.name = "InternalServerError";
  }
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const discordId = getAccessTokenFromRequest(request)?.discord?.id;

  if (error instanceof HttpError) {
    logger.error(`HTTP Exception - ${error.message}`, {
      exception: error.stack,
      discordId,
      http: {
        method: request.method,
        url: request.url,
      },
      statusCode: error.statusCode,
    });

    const response: Record<string, unknown> = {
      statusCode: error.statusCode,
      message: error.message,
    };

    if (error.details) {
      response.details = error.details;
    }

    // Add Retry-After header for rate limit errors
    if (
      error instanceof TooManyRequestsError &&
      (error as TooManyRequestsError).retryAfter
    ) {
      reply.header("Retry-After", (error as TooManyRequestsError).retryAfter);
    }

    return reply.status(error.statusCode).send(response);
  }

  // Handle Fastify validation errors
  if (error.validation) {
    logger.warn("Validation error", {
      discordId,
      http: {
        method: request.method,
        url: request.url,
      },
      validation: error.validation,
    });

    return reply.status(400).send({
      statusCode: 400,
      message: "Validation failed",
      details: error.validation,
    });
  }

  // Unhandled error
  logger.error(`Unhandled error - ${error.message}`, {
    exception: error.stack,
    discordId,
    http: {
      method: request.method,
      url: request.url,
    },
  });

  return reply.status(500).send({
    statusCode: 500,
    message: "Internal Server Error",
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  reply.status(404).send({ error: "Not Found" });
}
