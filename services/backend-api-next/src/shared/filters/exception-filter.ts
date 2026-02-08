import type { FastifyRequest, FastifyReply } from "fastify";
import { StandardException } from "../exceptions/standard.exception";
import { HttpError } from "../../infra/error-handler";
import type { ApiErrorCode } from "../constants/api-errors";

export type ExceptionErrorCodes = Record<
  string,
  { status: number; code: ApiErrorCode }
>;

type FastifyHandler<T = unknown> = (
  request: FastifyRequest<any>,
  reply: FastifyReply,
) => Promise<T>;

export function withExceptionFilter<T>(
  errorCodes: ExceptionErrorCodes,
  handler: FastifyHandler<T>,
): FastifyHandler<T> {
  return async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (err) {
      if (err instanceof StandardException) {
        const match = errorCodes[err.constructor.name];

        if (match) {
          throw new HttpError(
            match.status,
            match.code,
            undefined,
            err.subErrors.length > 0 ? err.subErrors : undefined,
          );
        }
      }

      throw err;
    }
  };
}

export function mergeExceptionErrorCodes(
  ...maps: ExceptionErrorCodes[]
): ExceptionErrorCodes {
  return Object.assign({}, ...maps);
}
