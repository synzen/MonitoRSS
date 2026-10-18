import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import path from 'path';
import { readFileSync } from 'fs';
import { inflate } from 'zlib';
import { promisify } from 'util';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Dispatcher,
} from 'undici';
import { RequestStatus } from './constants';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const inflatePromise = promisify(inflate);

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let agent: MockAgent;
  let originalDispatcher: Dispatcher;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');
  const capturedRequests: Array<{
    url: string;
    headers: Record<string, string | string[] | undefined>;
  }> = [];

  // nock cannot intercept undici.request, so the HTTP layer is mocked at the
  // undici dispatcher seam; everything around it (status handling, persistence
  // shaping, compression, cloudflare detection) runs for real.
  const mockUndiciResponse = (
    overrides: {
      statusCode?: number;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ) => {
    agent
      .get('https://rss-feed.com')
      .intercept({ path: '/feed.xml' })
      .reply((opts) => {
        capturedRequests.push({
          url: `${opts.origin}${opts.path}`,
          headers: (opts.headers as Record<string, string>) ?? {},
        });

        return {
          statusCode: overrides.statusCode ?? 200,
          data: overrides.body ?? feedXml,
          responseOptions: {
            headers: overrides.headers ?? { 'content-type': 'application/xml' },
          },
        };
      });
  };

  const mockUndiciFetchError = (error: Error) => {
    agent
      .get('https://rss-feed.com')
      .intercept({ path: '/feed.xml' })
      .replyWithError(error);
  };

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    setGlobalDispatcher(agent);
    capturedRequests.length = 0;

    const configService = {
      getOrThrow: () => defaultUserAgent,
    } as unknown as ConfigService;

    service = new FeedFetcherService(
      configService,
      {} as never,
      {} as never,
      {} as never,
    );
    service.defaultUserAgent = defaultUserAgent;
    service.feedRequestTimeoutMs = 15000;
  });

  afterEach(async () => {
    setGlobalDispatcher(originalDispatcher);
    await agent.close();
  });

  it('should be defined', () => {
    assert.ok(service);
  });

  describe('fetchFeedResponse', () => {
    it('does not throw when status code is non-200', async () => {
      mockUndiciResponse({ statusCode: 401 });

      const response = await service.fetchFeedResponse(feedUrl);

      assert.ok(response);
    });

    it('returns the feed xml', async () => {
      mockUndiciResponse();

      const res = await service.fetchFeedResponse(feedUrl);

      assert.strictEqual(await res.text(), feedXml);
    });
  });

  describe('fetchAndSaveResponse', () => {
    it('uses the default user agent if no custom user agent', async () => {
      mockUndiciResponse();

      await service.fetchAndSaveResponse(feedUrl);

      assert.strictEqual(capturedRequests.length, 1);
      assert.strictEqual(capturedRequests[0].url, feedUrl);
      assert.strictEqual(
        capturedRequests[0].headers['user-agent'],
        defaultUserAgent,
      );
    });

    it('uses the explicit user agent header if provided', async () => {
      mockUndiciResponse();

      await service.fetchAndSaveResponse(feedUrl, {
        lookupDetails: undefined,
        headers: { 'User-Agent': 'my-user-agent' },
        source: undefined,
      });

      assert.strictEqual(capturedRequests.length, 1);
      assert.strictEqual(capturedRequests[0].url, feedUrl);
      assert.strictEqual(
        capturedRequests[0].headers['user-agent'],
        'my-user-agent',
      );
    });

    describe('if ok response', () => {
      it('returns the request insert correctly', async () => {
        mockUndiciResponse();

        const { request: insert, responseText } =
          await service.fetchAndSaveResponse(feedUrl);

        assert.partialDeepStrictEqual(insert, {
          url: feedUrl,
          lookupKey: feedUrl,
          status: RequestStatus.OK,
          fetchOptions: {
            headers: {
              'user-agent': defaultUserAgent,
            },
          },
          response: {
            statusCode: 200,
            headers: {
              'content-type': 'application/xml',
            },
          },
        });
        assert.strictEqual(responseText, feedXml);
        assert.ok(insert.response?.body?.hashKey);
      });

      it('stores the deflated feed content', async () => {
        mockUndiciResponse();

        const { request: insert } = await service.fetchAndSaveResponse(feedUrl);

        const contents = insert.response?.body?.contents;

        assert.ok(contents);

        const decoded = await inflatePromise(
          Buffer.from(contents as string, 'base64'),
        );

        assert.strictEqual(decoded.toString(), feedXml);
      });
    });

    describe('if not ok response', () => {
      const feedResponseBody = {
        message: 'failed',
      };

      it('returns the request insert correctly', async () => {
        mockUndiciResponse({
          statusCode: 404,
          body: JSON.stringify(feedResponseBody),
        });

        const { request: insert, responseText } =
          await service.fetchAndSaveResponse(feedUrl);

        assert.partialDeepStrictEqual(insert, {
          url: feedUrl,
          status: RequestStatus.BAD_STATUS_CODE,
          response: {
            statusCode: 404,
          },
        });
        assert.strictEqual(responseText, JSON.stringify(feedResponseBody));
      });
    });

    describe('if fetch failed', () => {
      it('returns a failed request insert correctly', async () => {
        mockUndiciFetchError(new Error('failed'));

        const { request: insert } = await service.fetchAndSaveResponse(feedUrl);

        assert.partialDeepStrictEqual(insert, {
          url: feedUrl,
          status: RequestStatus.FETCH_ERROR,
        });
        assert.ok(insert.errorMessage?.includes('failed'));
      });
    });
  });
});
