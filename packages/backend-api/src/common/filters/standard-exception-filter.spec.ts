import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import logger from '../../utils/logger';
import { ApiErrorCode, API_ERROR_MESSAGES } from '../constants/api-errors';
import { StandardException } from '../exceptions/standard-exception.exception';
import { StandardBaseExceptionFilter } from './standard-exception-filter';

jest.mock('../../utils/logger');

class MockException extends StandardException {}
class UnhandledMockException extends StandardException {}

const exceptionsRecord: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
  [MockException.name]: {
    code: ApiErrorCode.FEED_INVALID,
    status: HttpStatus.BAD_REQUEST,
  },
};

class TestExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = exceptionsRecord;
}

describe('StandardExceptionFilter', () => {
  let filter: StandardBaseExceptionFilter;

  beforeEach(() => {
    filter = new TestExceptionFilter();
    jest.resetAllMocks();
  });

  describe('catch', () => {
    const exceptionDetails = {
      code: ApiErrorCode.FEED_INVALID,
      message: API_ERROR_MESSAGES.FEED_INVALID,
      status: HttpStatus.BAD_REQUEST,
    };
    const code = jest.fn();
    const send = jest.fn();
    let host: ArgumentsHost;

    beforeEach(() => {
      jest
        .spyOn(filter, 'getExceptionDetails')
        .mockReturnValue(exceptionDetails);

      code.mockReturnValue({
        send,
      });

      host = {
        switchToHttp: () => ({
          getResponse: () => ({
            code,
          }),
        }),
      } as never;
    });

    it('returns the correct status for a non-standard exception', () => {
      const exception = new Error();

      filter.catch(exception, host);

      expect(code).toHaveBeenCalledWith(exceptionDetails.status);
      expect(send).toHaveBeenCalledWith({
        code: exceptionDetails.code,
        message: exceptionDetails.message,
        timestamp: expect.any(Number),
        errors: [],
        isStandardized: true,
      });
    });

    it('returns suberrors for a standard exception if they exist', () => {
      const exception = new MockException([
        new MockException(),
        new MockException(),
      ]);

      filter.catch(exception, host);

      expect(code).toHaveBeenCalledWith(exceptionDetails.status);
      expect(send).toHaveBeenCalledWith({
        code: exceptionDetails.code,
        message: exceptionDetails.message,
        timestamp: expect.any(Number),
        errors: [
          {
            code: ApiErrorCode.FEED_INVALID,
            message: API_ERROR_MESSAGES.FEED_INVALID,
          },
          {
            code: ApiErrorCode.FEED_INVALID,
            message: API_ERROR_MESSAGES.FEED_INVALID,
          },
        ],
        isStandardized: true,
      });
    });

    it('logs internal server errors', () => {
      const exception = new Error();

      jest.spyOn(filter, 'getExceptionDetails').mockReturnValue({
        code: ApiErrorCode.INTERNAL_ERROR,
        message: API_ERROR_MESSAGES.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });

      filter.catch(exception, host);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getExceptionDetails', () => {
    it('returns internal server error if it is not a standard exception', async () => {
      const exception = new Error('test');

      const details = filter.getExceptionDetails(exception);

      expect(details.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(details.code).toBe(ApiErrorCode.INTERNAL_ERROR);
    });

    it('returns interanl error if standard exception is unhandled', async () => {
      const exception = new UnhandledMockException();

      const details = filter.getExceptionDetails(exception);

      expect(details.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(details.code).toBe(ApiErrorCode.INTERNAL_ERROR);
    });

    it('returns the status, message, and code for a handled exception', () => {
      const exception = new MockException();

      const details = filter.getExceptionDetails(exception);

      expect(details.status).toBe(HttpStatus.BAD_REQUEST);
      expect(details.code).toBe(ApiErrorCode.FEED_INVALID);
      expect(details.message).toEqual(
        API_ERROR_MESSAGES[ApiErrorCode.FEED_INVALID],
      );
    });
  });
});
