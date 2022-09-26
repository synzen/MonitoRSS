/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { ApiErrorResponse } from "../types/api-error.type";
import logger from "../../utils/logger";
import { inspect } from "util";
import { ApiErrorCode, API_ERROR_MESSAGES } from "../constants/api-errors";
import { StandardException } from "../exceptions/standard-exception.exception";

@Catch()
export abstract class StandardBaseExceptionFilter implements ExceptionFilter {
  abstract exceptions: Record<
    string,
    {
      status: HttpStatus;
      code: ApiErrorCode;
    }
  >;

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const { code, message, status } = this.getExceptionDetails(exception);

    const errorDetails =
      exception instanceof StandardException
        ? exception.subErrors.map((err) => {
            const subErrDetails = this.getExceptionDetails(err);

            return {
              code: subErrDetails.code,
              message: subErrDetails.message,
            };
          })
        : [];

    const standardApiError: ApiErrorResponse = {
      code,
      message,
      timestamp: new Date().getTime() / 1000,
      errors: errorDetails,
      isStandardized: true,
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      logger.error(`Unhandled error: ${inspect(exception)}`);
    }

    response.code(status).send(standardApiError);
  }

  getExceptionDetails(exception: any) {
    const exceptionName = exception?.constructor?.name as string;
    const matchedException = this.exceptions[exceptionName];

    if (!matchedException || !(exception instanceof StandardException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL_ERROR,
        message: API_ERROR_MESSAGES[ApiErrorCode.INTERNAL_ERROR],
      };
    }

    const { status, code } = matchedException;

    return {
      status,
      code,
      message: API_ERROR_MESSAGES[code],
    };
  }
}
