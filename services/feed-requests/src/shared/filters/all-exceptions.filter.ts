/* eslint-disable @typescript-eslint/no-explicit-any */
import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as util from 'util';
import logger from '../../utils/logger';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(protected readonly httpAdapterHost: HttpAdapterHost) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      this.handleHttpException(exception, host);
    } else {
      this.handleInternalErrors(exception, host);
    }
  }

  private handleHttpException(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const statusCode = exception.getStatus();
    const response = ctx.getResponse<FastifyReply>();
    const { httpAdapter } = this.httpAdapterHost;

    const res = exception.getResponse() as Record<string, any>;
    const req = ctx.getRequest<FastifyRequest>();

    logger.error(exception.message, exception);
    logger.error(`HTTP Exception - ${exception.message}`, {
      exception: exception.stack || exception,
      http: {
        method: req.method,
        url: req.url,
        res,
      },
    });

    logger.error(`HTTP Exception: ${exception.message}`, exception);

    httpAdapter.reply(response, res, statusCode);
  }

  private handleInternalErrors(exception: Error | any, host: ArgumentsHost) {
    logger.error(
      `Unhandled error - ${exception.message || util.inspect(exception)}`,
      {
        exception: exception.stack || exception,
      },
    );

    super.catch(exception, host);
  }
}
