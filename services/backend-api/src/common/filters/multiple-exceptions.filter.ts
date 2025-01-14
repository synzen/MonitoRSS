import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../constants/api-errors";
import { StandardBaseExceptionFilter } from "./standard-exception-filter";
import { StandardException } from "../exceptions";

export const createMultipleExceptionsFilter = (
  ...errorCodes: Array<
    Record<string, { status: HttpStatus; code: ApiErrorCode }>
  >
) => {
  const useExceptionsMap: Record<
    string,
    { status: HttpStatus; code: ApiErrorCode }
  > = {};

  errorCodes.forEach((error) => {
    Object.keys(error).forEach((key) => {
      useExceptionsMap[key] = error[key];
    });
  });

  @Catch(StandardException)
  class MultipleExceptionFilter extends StandardBaseExceptionFilter {
    exceptions = useExceptionsMap;
  }

  return MultipleExceptionFilter;
};
