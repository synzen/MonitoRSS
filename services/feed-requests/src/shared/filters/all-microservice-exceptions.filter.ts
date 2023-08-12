import {
  Catch,
  HttpStatus,
  HttpException,
  ExceptionFilter,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { status } from '@grpc/grpc-js';

@Catch(HttpException)
export class AllMicroserviceExceptionsFilter implements ExceptionFilter {
  // https://github.com/nestjs/nest/issues/1953
  static HttpStatusCode: Record<number, number> = {
    // standard gRPC error mapping
    // https://cloud.google.com/apis/design/errors#handling_errors
    [HttpStatus.BAD_REQUEST]: status.INVALID_ARGUMENT,
    [HttpStatus.UNAUTHORIZED]: status.UNAUTHENTICATED,
    [HttpStatus.FORBIDDEN]: status.PERMISSION_DENIED,
    [HttpStatus.NOT_FOUND]: status.NOT_FOUND,
    [HttpStatus.CONFLICT]: status.ALREADY_EXISTS,
    [HttpStatus.GONE]: status.ABORTED,
    [HttpStatus.TOO_MANY_REQUESTS]: status.RESOURCE_EXHAUSTED,
    499: status.CANCELLED,
    [HttpStatus.INTERNAL_SERVER_ERROR]: status.INTERNAL,
    [HttpStatus.NOT_IMPLEMENTED]: status.UNIMPLEMENTED,
    [HttpStatus.BAD_GATEWAY]: status.UNKNOWN,
    [HttpStatus.SERVICE_UNAVAILABLE]: status.UNAVAILABLE,
    [HttpStatus.GATEWAY_TIMEOUT]: status.DEADLINE_EXCEEDED,

    // additional built-in http exceptions
    // https://docs.nestjs.com/exception-filters#built-in-http-exceptions
    [HttpStatus.HTTP_VERSION_NOT_SUPPORTED]: status.UNAVAILABLE,
    [HttpStatus.PAYLOAD_TOO_LARGE]: status.OUT_OF_RANGE,
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: status.CANCELLED,
    [HttpStatus.UNPROCESSABLE_ENTITY]: status.CANCELLED,
    [HttpStatus.I_AM_A_TEAPOT]: status.UNKNOWN,
    [HttpStatus.METHOD_NOT_ALLOWED]: status.CANCELLED,
    [HttpStatus.PRECONDITION_FAILED]: status.FAILED_PRECONDITION,
  };

  catch(exception: HttpException): Observable<never> | void {
    const httpStatus = exception.getStatus();
    const httpRes = exception.getResponse() as { details?: unknown };

    return throwError(() => ({
      code:
        AllMicroserviceExceptionsFilter.HttpStatusCode[httpStatus] ??
        status.UNKNOWN,
      message: exception.message,
      details: Array.isArray(httpRes.details) ? httpRes.details : undefined,
    }));
  }
}
