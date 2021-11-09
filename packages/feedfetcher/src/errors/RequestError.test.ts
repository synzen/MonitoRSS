import RequestError from './RequestError';

describe('RequestError', () => {
  describe('isCloudflare', () => {
    it('returns correctly', () => {
      const error = new RequestError(RequestError.CODES.BLOCKED_BY_CLOUDFLARE, 'mesage');
      console.log(error instanceof RequestError);
      expect(error.isCloudflare()).toBe(true);
    });
  });

  describe('static Cloudflare', () => {
    it('returns an instance of RequestError', () => {
      const error = RequestError.Cloudflare('message');
      expect(error).toBeInstanceOf(RequestError);
      expect(error.code).toEqual(RequestError.CODES.BLOCKED_BY_CLOUDFLARE);
    });
  });

  describe('static BadStatusCode', () => {
    it('returns an instance of RequestError', () => {
      const error = RequestError.BadStatusCode('message');
      expect(error).toBeInstanceOf(RequestError);
      expect(error.code).toEqual(RequestError.CODES.BAD_RESPONSE_CODE);
    });
  });

  describe('TimedOut', () => {
    it('returns an instance of RequestError', () => {
      const error = RequestError.TimedOut('message');
      expect(error).toBeInstanceOf(RequestError);
      expect(error.code).toEqual(RequestError.CODES.TIMEOUT);
    });
  });
});
