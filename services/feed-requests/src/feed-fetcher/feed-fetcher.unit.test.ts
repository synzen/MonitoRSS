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
import { createFeedFetcherService } from './feed-fetcher';
import { createPlatformProviderRouter } from '../platform-providers/router';
import type {
  PlatformFeedIdentity,
  PlatformProviderRegistry,
} from '../platform-providers/types';
import { RequestStatus } from '../feed-fetcher/types';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const inflatePromise = promisify(inflate);

describe('FeedFetcherService', () => {
  let service: ReturnType<typeof createFeedFetcherService>;
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

    service = createFeedFetcherService({
      defaultUserAgent,
      requestTimeoutMs: 15000,
      objectFileStorage: {} as never,
      cacheStorage: {} as never,
      partitionedRequestsStore: {} as never,
    });
  });

  afterEach(async () => {
    setGlobalDispatcher(originalDispatcher);
    await agent.close();
  });

  it('is defined', () => {
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

    it('uses the xml-only accept header for hosts that content-negotiate', async () => {
      const rssgroundUrl =
        'https://www.rssground.com/services/facebook-rss/abc';

      agent
        .get('https://www.rssground.com')
        .intercept({ path: '/services/facebook-rss/abc' })
        .reply((opts) => {
          capturedRequests.push({
            url: `${opts.origin}${opts.path}`,
            headers: (opts.headers as Record<string, string>) ?? {},
          });

          return {
            statusCode: 200,
            data: feedXml,
            responseOptions: {
              headers: { 'content-type': 'application/xml' },
            },
          };
        });

      await service.fetchAndSaveResponse(rssgroundUrl);

      assert.strictEqual(
        capturedRequests[0].headers['accept'],
        'application/rss+xml,application/xml,text/xml,*/*;q=0.8',
      );
    });

    it('uses the default accept header for all other hosts', async () => {
      mockUndiciResponse();

      await service.fetchAndSaveResponse(feedUrl);

      assert.strictEqual(
        capturedRequests[0].headers['accept'],
        'text/html,text/xml,application/xml,application/rss+xml',
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

  describe('platform provider routing', () => {
    const redditUrl = 'https://www.reddit.com/r/javascript';
    const instagramUrl = 'https://www.instagram.com/adrienbrody';
    const providerOrigin = 'http://mock-provider.test';
    const providerRss = `<rss><channel>
      <item>
        <guid>t3_1abcde</guid>
        <link>https://www.reddit.com/r/javascript/comments/1abcde/x/</link>
        <title>Post A</title>
      </item>
    </channel></rss>`;

    // The registry owns matching wholesale, so its stub parses the platform
    // URLs itself — mirroring how the private package declares its hosts.
    const matchPlatformUrl = (url: string): PlatformFeedIdentity | null => {
      let parsed: URL;

      try {
        parsed = new URL(url);
      } catch {
        return null;
      }

      // Legacy platform RSS URLs fall through, like the real matcher.
      if (
        parsed.hostname.toLowerCase().startsWith('rss.') ||
        parsed.pathname.endsWith('.rss')
      ) {
        return null;
      }

      const segments = parsed.pathname.split('/').filter(Boolean);

      if (
        parsed.hostname === 'www.reddit.com' &&
        segments.length === 2 &&
        segments[0] === 'r'
      ) {
        return {
          platform: 'reddit',
          kind: 'subreddit',
          value: segments[1],
        };
      }

      if (parsed.hostname === 'www.instagram.com' && segments.length === 1) {
        return {
          platform: 'instagram',
          kind: 'user',
          value: segments[0],
        };
      }

      if (parsed.hostname === 'x.com' && segments.length === 1) {
        return {
          platform: 'twitter',
          kind: 'user',
          value: segments[0],
        };
      }

      return null;
    };

    // A stub vendor adapter: GETs a provider URL derived from the identity
    // and surfaces error statuses. freshnessSeconds simulates the provider
    // response's reported reuse window.
    const registryWithProvider = (
      providerName = 'private-default',
      freshnessSeconds?: number,
    ): PlatformProviderRegistry => ({
      findMatchingPlatform: matchPlatformUrl,
      adapters: {
        reddit: {
          [providerName]: ({ httpGet: adapterHttpGet }) => ({
            async fetchFeedDocument(identity) {
              const res = await adapterHttpGet(
                `${providerOrigin}/reddit/${identity.kind}/${identity.value}`,
              );

              if (!res.ok) {
                throw Object.assign(
                  new Error(`Provider responded with status ${res.status}`),
                  { requestStatus: 'BAD_STATUS_CODE', statusCode: res.status },
                );
              }

              return {
                document: await res.text(),
                freshnessSeconds,
              };
            },
          }),
        },
      },
      defaults: { reddit: providerName },
    });

    const instagramRss = `<rss><channel><item><guid>instagram-post-1</guid><link>https://www.instagram.com/p/Cmock0001/</link><title>Instagram post</title></item></channel></rss>`;
    const instagramRegistry = (): PlatformProviderRegistry => {
      const registry = registryWithProvider();
      registry.adapters.instagram = {
        fetchlayer: () => ({
          async fetchFeedDocument() {
            return { document: instagramRss };
          },
        }),
      };
      registry.defaults.instagram = 'fetchlayer';
      return registry;
    };

    const interceptProvider = (overrides: { statusCode?: number } = {}) => {
      agent
        .get(providerOrigin)
        .intercept({ path: '/reddit/subreddit/javascript' })
        .reply((opts) => {
          capturedRequests.push({
            url: `${opts.origin}${opts.path}`,
            headers: (opts.headers as Record<string, string>) ?? {},
          });

          return {
            statusCode: overrides.statusCode ?? 200,
            data: providerRss,
            responseOptions: {
              headers: { 'content-type': 'application/rss+xml' },
            },
          };
        });
    };

    const createServiceWithRegistry = (
      registry: PlatformProviderRegistry,
      platformResponseFreshnessSeconds?: number,
    ) =>
      createFeedFetcherService({
        defaultUserAgent,
        requestTimeoutMs: 15000,
        platformResponseFreshnessSeconds,
        objectFileStorage: {} as never,
        cacheStorage: {} as never,
        partitionedRequestsStore: {} as never,
        platformSourceRouterFactory: (httpGet) =>
          createPlatformProviderRouter({
            matchPlatform: (url) => registry.findMatchingPlatform(url),
            platformProviderRegistry: registry,
            httpGet,
          }),
      });

    it('routes a reddit destination URL to the provider adapter', async () => {
      interceptProvider();

      const routedService = createServiceWithRegistry(registryWithProvider());

      const { request: insert, responseText } =
        await routedService.fetchAndSaveResponse(redditUrl, {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        });

      assert.strictEqual(capturedRequests.length, 1);
      assert.strictEqual(
        capturedRequests[0].url,
        `${providerOrigin}/reddit/subreddit/javascript`,
      );
      assert.partialDeepStrictEqual(insert, {
        // The stored URL remains the user-facing destination URL.
        url: redditUrl,
        lookupKey: redditUrl,
        status: RequestStatus.OK,
        response: {
          statusCode: 200,
          headers: { 'content-type': 'application/rss+xml' },
        },
      });
      assert.strictEqual(responseText, providerRss);
      assert.ok(insert.response?.body?.hashKey);
      assert.ok(insert.response?.body?.contents);
    });

    it('routes an enabled instagram destination URL to the provider adapter', async () => {
      const routedService = createServiceWithRegistry(instagramRegistry());

      const { request: insert, responseText } =
        await routedService.fetchAndSaveResponse(instagramUrl, {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        });

      assert.strictEqual(capturedRequests.length, 0);
      assert.strictEqual(responseText, instagramRss);
      assert.partialDeepStrictEqual(insert, {
        url: instagramUrl,
        lookupKey: instagramUrl,
        status: RequestStatus.OK,
        response: {
          statusCode: 200,
          headers: { 'content-type': 'application/rss+xml' },
        },
      });
    });

    it('advertises freshness on platform responses when configured', async () => {
      interceptProvider();

      const routedService = createServiceWithRegistry(
        registryWithProvider(),
        3600,
      );

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      // The freshness directive is what lets the scheduler's freshness skip
      // collapse repeat fetches of the same URL into one provider call.
      assert.partialDeepStrictEqual(insert.response?.headers, {
        'cache-control': 'public, max-age=3600',
      });
    });

    it('does not advertise freshness on platform responses when unconfigured', async () => {
      interceptProvider();

      const routedService = createServiceWithRegistry(registryWithProvider());

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      assert.ok(
        insert.response?.headers &&
          !('cache-control' in insert.response.headers),
      );
    });

    it('uses the freshness reported by the provider response over the fallback', async () => {
      interceptProvider();

      const routedService = createServiceWithRegistry(
        registryWithProvider('private-default', 120),
        3600,
      );

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      assert.partialDeepStrictEqual(insert.response?.headers, {
        'cache-control': 'public, max-age=120',
      });
    });

    it('advertises no reuse window when the provider response reports no-store', async () => {
      interceptProvider();

      const routedService = createServiceWithRegistry(
        registryWithProvider('private-default', 0),
        3600,
      );

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      // max-age=0 from the provider (e.g. reddit's no-store) must suppress
      // the fallback directive so every due tick refetches.
      assert.ok(
        insert.response?.headers &&
          !('cache-control' in insert.response.headers),
      );
    });

    it('maps an unknown provider name into a failed request insert', async () => {
      const registry = registryWithProvider('vendor-x');
      registry.adapters.reddit = {};

      const routedService = createServiceWithRegistry(registry);

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      assert.strictEqual(capturedRequests.length, 0);
      assert.partialDeepStrictEqual(insert, {
        url: redditUrl,
        status: RequestStatus.FETCH_ERROR,
      });
      assert.match(insert.errorMessage || '', /Unknown platform provider/);
    });

    it('maps a provider error status into BAD_STATUS_CODE', async () => {
      interceptProvider({ statusCode: 503 });

      const routedService = createServiceWithRegistry(registryWithProvider());

      const { request: insert } = await routedService.fetchAndSaveResponse(
        redditUrl,
        {
          lookupDetails: undefined,
          source: undefined,
          usePlatformProvider: true,
        },
      );

      assert.partialDeepStrictEqual(insert, {
        url: redditUrl,
        status: RequestStatus.BAD_STATUS_CODE,
        // The provider status stays on the row so consumers map it through
        // the existing status-code taxonomy.
        response: { statusCode: 503 },
      });
      assert.match(insert.errorMessage || '', /status 503/);
    });

    it('falls through to the normal fetch path for legacy reddit RSS URLs', async () => {
      const legacyUrl = 'https://www.reddit.com/r/javascript.rss';

      agent
        .get('https://www.reddit.com')
        .intercept({ path: '/r/javascript.rss' })
        .reply(() => ({
          statusCode: 200,
          data: providerRss,
          responseOptions: {
            headers: { 'content-type': 'application/rss+xml' },
          },
        }));

      const routedService = createServiceWithRegistry(registryWithProvider());

      const { request: insert } =
        await routedService.fetchAndSaveResponse(legacyUrl);

      // The legacy RSS URL is fetched directly, not routed to a provider.
      assert.strictEqual(capturedRequests.length, 0);
      assert.partialDeepStrictEqual(insert, {
        url: legacyUrl,
        status: RequestStatus.OK,
      });
    });

    it('takes the existing fetch path for non-platform URLs', async () => {
      mockUndiciResponse();

      const routedService = createServiceWithRegistry(registryWithProvider());

      await routedService.fetchAndSaveResponse(feedUrl);

      assert.strictEqual(capturedRequests.length, 1);
      assert.strictEqual(capturedRequests[0].url, feedUrl);
    });

    it('keeps a recognized non-reddit platform URL on the normal fetch path when not enabled', async () => {
      const twitterUrl = 'https://x.com/jack';

      // The registry knows no twitter provider, so the matched URL must not
      // route; the normal fetch path still runs (mocked to succeed).
      agent
        .get('https://x.com')
        .intercept({ path: '/jack' })
        .reply(() => ({
          statusCode: 200,
          data: feedXml,
          responseOptions: {
            headers: { 'content-type': 'application/xml' },
          },
        }));

      const routedService = createServiceWithRegistry(registryWithProvider());

      const { request: insert } =
        await routedService.fetchAndSaveResponse(twitterUrl);

      assert.strictEqual(capturedRequests.length, 0);
      assert.strictEqual(insert.url, twitterUrl);
      assert.strictEqual(insert.status, RequestStatus.OK);
    });
  });
});
