import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

import { AddressLocationNotAllowedException } from "../../paddle/exceptions/address-location-not-allowed.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [AddressLocationNotAllowedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.ADDRESS_LOCATION_NOT_ALLOWED,
    },
  };

@Catch(StandardException)
export class SubscriptionProductsExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
