import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { getAccessTokenFromRequest } from "./auth";
import logger from "./logger";
import {
  ApiErrorCode,
  API_ERROR_MESSAGES,
} from "../shared/constants/api-errors";
import type { ApiErrorResponse } from "../shared/types/api-error.type";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? API_ERROR_MESSAGES[code]);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(
    code: ApiErrorCode = ApiErrorCode.UNAUTHORIZED,
    message?: string,
  ) {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(code: ApiErrorCode, message?: string) {
    super(403, code, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(code: ApiErrorCode, message?: string) {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends HttpError {
  constructor(code: ApiErrorCode, message?: string, details?: unknown) {
    super(400, code, message, details);
    this.name = "BadRequestError";
  }
}

export class ConflictError extends HttpError {
  constructor(code: ApiErrorCode, message?: string) {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(code: ApiErrorCode, message?: string, details?: unknown) {
    super(422, code, message, details);
    this.name = "UnprocessableEntityError";
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(
    code: ApiErrorCode,
    message?: string,
    public readonly retryAfter?: number,
  ) {
    super(429, code, message);
    this.name = "TooManyRequestsError";
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(
    code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
    message?: string,
  ) {
    super(503, code, message);
    this.name = "ServiceUnavailableError";
  }
}

export class InternalServerError extends HttpError {
  constructor(
    code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
    message?: string,
  ) {
    super(500, code, message);
    this.name = "InternalServerError";
  }
}

function createErrorResponse(
  code: ApiErrorCode,
  message?: string,
  errors: Array<{ message: string }> = [],
): ApiErrorResponse {
  return {
    code,
    message: message ?? API_ERROR_MESSAGES[code],
    timestamp: Date.now() / 1000,
    errors,
    isStandardized: true,
  };
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message?: string,
): FastifyReply {
  return reply.status(statusCode).send(createErrorResponse(code, message));
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const discordId = getAccessTokenFromRequest(request)?.discord?.id;

  if (error instanceof HttpError) {
    if (!(error instanceof UnauthorizedError)) {
      logger.error(`HTTP Exception - ${error.message}`, {
        exception: error.stack,
        discordId,
        http: {
          method: request.method,
          url: request.url,
        },
        statusCode: error.statusCode,
      });
    }

    if (
      error instanceof TooManyRequestsError &&
      (error as TooManyRequestsError).retryAfter
    ) {
      reply.header("Retry-After", (error as TooManyRequestsError).retryAfter);
    }

    const errors: Array<{ message: string }> = [];
    if (error.details && Array.isArray(error.details)) {
      for (const detail of error.details) {
        if (
          typeof detail === "object" &&
          detail !== null &&
          "message" in detail
        ) {
          errors.push({ message: String(detail.message) });
        }
      }
    }

    return reply
      .status(error.statusCode)
      .send(createErrorResponse(error.code, error.message, errors));
  }

  if (error.validation) {
    const errors = error.validation.map((v) => ({
      message: v.instancePath
        ? `${v.instancePath} ${v.message ?? ""}`
        : v.message ?? "",
    }));

    logger.warn(`Validation failed`, {
      discordId,
      http: {
        method: request.method,
        url: request.url,
      },
      validationErrors: errors,
    });

    return reply
      .status(400)
      .send(
        createErrorResponse(ApiErrorCode.VALIDATION_FAILED, undefined, errors),
      );
  }

  logger.error(`Unhandled error - ${error.message}`, {
    exception: error.stack,
    discordId,
    http: {
      method: request.method,
      url: request.url,
    },
  });

  return reply
    .status(500)
    .send(createErrorResponse(ApiErrorCode.INTERNAL_ERROR));
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  sendError(reply, 404, ApiErrorCode.ROUTE_NOT_FOUND, "Not Found");
}

export { ApiErrorCode } from "../shared/constants/api-errors";
