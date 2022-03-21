import { Catch, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/constants/api-errors';
import { StandardException } from '../../../common/exceptions/standard-exception.exception';
import { StandardBaseExceptionFilter } from '../../../common/filters/standard-exception-filter';
import { WebhookMissingPermissionsException } from '../exceptions';

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [WebhookMissingPermissionsException.name]: {
      status: HttpStatus.FORBIDDEN,
      code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
    },
  };

@Catch(StandardException)
export class WebhookExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
