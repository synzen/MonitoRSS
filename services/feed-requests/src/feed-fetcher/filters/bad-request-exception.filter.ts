import { Catch, RpcExceptionFilter, BadRequestException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { GrpcInvalidArgumentException } from '../../shared/exceptions';
import logger from '../../utils/logger';
import { inspect } from 'util';

@Catch(BadRequestException)
export class BadRequestExceptionFilter
  implements RpcExceptionFilter<RpcException>
{
  catch(exception: RpcException): Observable<any> {
    logger.info(
      `BadRequestException filter caught exception ${inspect(exception.stack)}`,
    );

    if (exception instanceof BadRequestException) {
      const errorMessage = String(
        (exception.getResponse() as Record<string, any>)?.message,
      );

      return throwError(() => new GrpcInvalidArgumentException(errorMessage));
    }

    return throwError(() => exception);
  }
}
