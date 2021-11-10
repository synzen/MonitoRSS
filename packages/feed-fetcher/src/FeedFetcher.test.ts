import { mocked } from 'ts-jest/utils';
import { request } from 'undici';
import FeedFetcher from './FeedFetcher';
import RequestError from './errors/RequestError';
import { Readable } from 'stream';

jest.mock('./ArticleIDResolver');
jest.mock('./DecodedFeedParser');
jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.useFakeTimers();

const fetch = mocked(request);

describe('Unit::FeedFetcher', function () {
  let feedFetcher: FeedFetcher;

  beforeEach(() => {
    feedFetcher = new FeedFetcher();
  });
  afterEach(function () {
    jest.restoreAllMocks();
    fetch.mockReset();
  });

  describe('static resolveUserAgent', function () {
    it('adds GoogleBot if tumblr', function () {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ' +
        'rv:78.0) Gecko/20100101 Firefox/78.0';
      const url = 'https://whatever.tumblr.com';
      const newUserAgent = FeedFetcher.resolveUserAgent(url, userAgent);
      expect(newUserAgent).toEqual('Mozilla/5.0 ' +
      'GoogleBot (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0');
    });
    it('returns the same string if not tumblr', function () {
      const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101
        Firefox/78.0`;
      const url = 'https://www.google.com';
      const newUserAgent = FeedFetcher.resolveUserAgent(url, userAgent);
      expect(newUserAgent).toEqual(userAgent);
    });
  });
  
  describe('createFetchOptions', function () {
    const resolvedUserAgent = 'swry4e3';

    beforeEach(function () {
      feedFetcher = new FeedFetcher({
        defaultUserAgent: resolvedUserAgent,
      });
    });

    afterEach(function () {
      jest.clearAllTimers();
    });

    it('adds the request options with the default headers', function () {
      const requestOptions = {
        method: 'GET' as const,
        headers: {
          'user-agent': resolvedUserAgent,
        },
      };
      const returned = feedFetcher.createFetchOptions('url1', requestOptions);
      expect(returned.options)
        .toEqual(expect.objectContaining(requestOptions));
    });
    it('adds the passed in headers', function () {
      const headers = {
        foz: 'baz',
      };
      const requestOptions = {
        method: 'GET' as const,
        headers,
      };
      const returned = feedFetcher.createFetchOptions('url2', requestOptions);
      expect(returned.options.headers)
        .toEqual(expect.objectContaining(headers));
    });
    it('adds the abort signal', function () {
      const signal = jest.fn();
      const abort = jest.fn();
      const controller = {
        signal,
        abort,
      };
      jest.spyOn(global, 'AbortController').mockReturnValue(controller as any);
      const returned = feedFetcher.createFetchOptions('asd', { method: 'GET' });
      expect(returned.options.signal).toEqual(controller.signal);
    });
    it('aborts the signal with the timeout value passed in options', function () {
      const signal = jest.fn();
      const abort = jest.fn();
      const controller = {
        signal,
        abort,
      };
      jest.spyOn(global, 'AbortController').mockReturnValue(controller as any);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const timeoutMs = 105;
      feedFetcher = new FeedFetcher({
        feedRequestTimeoutMs: timeoutMs,
      });
      feedFetcher.createFetchOptions('asd', { method: 'GET' });
      jest.runAllTimers();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), timeoutMs);
      expect(abort).toHaveBeenCalled();
    });
    it('aborts the signal with the default value if no value is passed', function () {
      const signal = jest.fn();
      const abort = jest.fn();
      const controller = {
        signal,
        abort,
      };
      jest.spyOn(global, 'AbortController').mockReturnValue(controller as any);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      feedFetcher.createFetchOptions('asd', { method: 'GET' });
      jest.runAllTimers();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
      expect(abort).toHaveBeenCalled();
    });
  });
  describe('fetchURL', function () {
    beforeEach(function () {
      jest.spyOn(feedFetcher, 'createFetchOptions').mockReturnValue({
        options: {
          method: 'GET',
          headers: {},
        },
        timeout: {} as any,
      });
    });
    describe('retried is false', function () {
      it('throws an error if url is not defined', function () {
        return expect(feedFetcher.fetchURL('')).rejects.toThrow(Error);
      });
      it('passes the options to fetch', async function () {
        const reqOpts = {
          method: 'GET' as const,
          headers: {
            'user-agent': 'asd',
          },
        };
        jest.spyOn(feedFetcher, 'createFetchOptions')
          .mockReturnValue({
            options: reqOpts,
            timeout: {} as any,
          });
        fetch.mockResolvedValueOnce({ statusCode: 200 } as any);
        await feedFetcher.fetchURL('abc', reqOpts);
        const passedObject = fetch.mock.calls[0][1];
        expect(passedObject?.headers).toEqual(reqOpts.headers);
      });
      it('does no recursive call if fetch failed and retried is true', function (done) {
        feedFetcher.fetchURL('abc', { method: 'GET' }, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
            done();
          })
          .catch(done);
      });
      it('throws a RequestError if fetch throws an error', async function () {
        const error = new Error('abc');
        fetch.mockRejectedValueOnce(error);
        await expect(feedFetcher.fetchURL('abc'))
          .rejects.toThrow(RequestError);
      });
      it('returns the stream and response if the response status is 200', async function () {
        const body = 'abc';
        const response = { body, statusCode: 200 };
        fetch.mockResolvedValueOnce(response as any);
        const data = await feedFetcher.fetchURL('abc');
        expect(data).toEqual({ stream: body, response });
      });
      it(`returns the stream and response if the response status is 304 with If-Modified-Since
        and If-None-Match is in request headers`,
      async function () {
        const headers = { 'If-Modified-Since': 'a', 'If-None-Match': 'b' };
        jest.spyOn(feedFetcher, 'createFetchOptions')
          .mockReturnValue({
            options: {
              method: 'GET',
              headers,
            },
            timeout: {} as any,
          });
        const body = 'abc';
        const response = { body, statusCode: 304 };
        fetch.mockResolvedValueOnce(response as any);
        const data = await feedFetcher.fetchURL('abc', { method: 'GET', headers });
        expect(data).toEqual({ stream: body, response });
      });
      it('recursively calls again if res status is 403/400', async function () {
        fetch
          .mockResolvedValueOnce({ statusCode: 403 } as any)
          .mockResolvedValueOnce({ statusCode: 200 } as any);
        const spy = jest.spyOn(feedFetcher, 'fetchURL');
        await feedFetcher.fetchURL('abc');
        expect(spy).toHaveBeenCalledTimes(2);
      });
      it('recursively calls with empty user agent if res status is 403/400', async function () {
        const headers = { a: 'b', c: 'd' };
        const fetchURL = jest.spyOn(feedFetcher, 'fetchURL');
        fetch
          .mockResolvedValueOnce({ statusCode: 403 } as any)
          .mockResolvedValueOnce({ statusCode: 200 } as any);
        await feedFetcher.fetchURL('abc', { method: 'GET', headers });
        // @ts-ignore
        expect(fetchURL.mock.calls[1][1]?.headers['user-agent']).toEqual('');
      });
    });
    describe('request failed and retried is true', function () {
      it('throws a RequestError if res headers does not include cloudflare', async function () {
        fetch.mockResolvedValueOnce({
          statusCode: 403,
          headers: {
            get: () => null,
          } as any,
        } as any);
        return expect(feedFetcher.fetchURL('abc', {
          method: 'GET',
        }, true)).rejects.toBeInstanceOf(RequestError);
      });
      it('throws a cloudflare error', async function () {
        fetch
          .mockResolvedValue({
            statusCode: 403,
            headers: {
              get: () => ['cloudflare'] as any,
            },
          } as any);
        await expect(feedFetcher.fetchURL('a', {
          method: 'GET',
        }, true))
          .rejects.toThrowError(RequestError);
      });
    });
  });
  describe('parseStream', function () {
    it('throws an error if no stream is defined', function () {
      return expect(feedFetcher.parseStream(null, '', '')).rejects.toThrowError();
    });
    it('rejects if the stream emits an error', function (done) {
      const stream = new Readable();
      const error = new Error('aszf');
      jest.spyOn(stream, 'pipe').mockImplementation(() => {
        stream.emit('error', error);
        return stream as any;
      });
      feedFetcher.parseStream(stream, 'asd', '')
        .then(() => {
          done(new Error('Promise Resolved'));
        })
        .catch(err => {
          expect(err).toEqual(error);
          done();
        })
        .catch(done);
    });
    it.todo('rejects with a FeedParserError if feedparser emits an error');
    it.todo('rejects with the feedparser error code if the error is not a feed');
    it.todo('attaches the ._id property to all articles');
    it.todo('returns the article list with the id type');
  });
  describe('fetchFeed', function () {
    const fetchURLResults = {
      stream: 'abc',
      response: {
        headers: {},
      },
    };
    let fetchURLSpy: jest.SpyInstance;
    let parseStreamSpy: jest.SpyInstance;

    beforeEach(function () {
      jest.spyOn(feedFetcher, 'getCharsetFromHeaders')
        .mockImplementation();
      fetchURLSpy = jest.spyOn(feedFetcher, 'fetchURL').mockResolvedValue(fetchURLResults as any);
      parseStreamSpy = jest.spyOn(feedFetcher, 'parseStream').mockResolvedValue({} as any);
    });
    it('passes the url, options and charset to fetchURL', async function () {
      const url = 'abc';
      const opts = {
        method: 'GET' as const,
        headers: {
          'a': '1',
        },
      };
      await feedFetcher.fetchFeed(url, opts);
      expect(fetchURLSpy).toHaveBeenCalledWith(url, opts);
    });
    it('passes the stream from fetchURL and url to parseStream', async function () {
      const url = 'abzz';
      const charset = 'aedswry';
      jest.spyOn(feedFetcher, 'getCharsetFromHeaders')
        .mockReturnValue(charset);
      await feedFetcher.fetchFeed(url);
      expect(parseStreamSpy).toHaveBeenCalledWith(fetchURLResults.stream, url, charset);
    });
    it('returns the articleList and idType', async function () {
      const results = await feedFetcher.fetchFeed('');
      expect(Object.prototype.hasOwnProperty.call(results, 'articleList')).toEqual(true);
      expect(Object.prototype.hasOwnProperty.call(results, 'idType')).toEqual(true);
    });
  });
  describe('static getCharsetFromHeaders', function () {
    it('returns the charset', function () {
      const response = {
        headers: {
          'content-type': 'application/rss+xml; charset=ISO-8859-1',
        },
      };
      expect(feedFetcher.getCharsetFromHeaders(response.headers))
        .toEqual('ISO-8859-1');
    });
    it('does not throw on incomplete headers', function () {
      const response = {
        headers: {},
      };
      expect(() => feedFetcher.getCharsetFromHeaders(response.headers))
        .not.toThrow();
    });
  });
});
