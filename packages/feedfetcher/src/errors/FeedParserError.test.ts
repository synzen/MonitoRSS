import FeedParserError from './FeedParserError';

describe('FeedParserError', () => {
  describe('static InvalidFeed', () => {
    it('returns an instance of FeedParserError', () => {
      const error = FeedParserError.InvalidFeed('message');
      expect(error).toBeInstanceOf(FeedParserError);
    });
  });
});
