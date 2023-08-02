/* eslint-disable @typescript-eslint/no-explicit-any */
import { Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { FastifyReply, FastifyRequest } from "fastify";
import * as util from "util";
import { getAccessTokenFromRequest } from "../../features/discord-auth/utils/get-access-token-from-session";
import logger from "../../utils/logger";

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
      discordId: getAccessTokenFromRequest(req)?.discord?.id,
      http: {
        method: req.method,
        url: req.url,
        res,
      },
    });

    httpAdapter.reply(response, res, statusCode);
  }

  private handleInternalErrors(exception: Error | any, host: ArgumentsHost) {
    const httpHost = host.switchToHttp();

    const req = httpHost.getRequest<FastifyRequest>();

    const discordId = getAccessTokenFromRequest(req)?.discord?.id;
    logger.error(
      `Unhandled error - ${exception.message || util.inspect(exception)}`,
      {
        exception: exception.stack || exception,
        discordId,
        http: {
          method: req.method,
          url: req.url,
        },
      }
    );

    super.catch(exception, host);
  }
}
