import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import path from 'path';
import { readFileSync } from 'fs';
import { inflate } from 'zlib';
import { promisify } from 'util';
import { request } from 'undici';
import { RequestStatus } from './constants';

jest.mock('undici', () => ({
  request: jest.fn(),
  Agent: jest.fn(),
  setGlobalDispatcher: jest.fn(),
  getGlobalDispatcher: jest.fn(() => ({ compose: jest.fn((d) => d) })),
  interceptors: { redirect: jest.fn((d) => d) },
}));
jest.mock('../utils/logger');

const inflatePromise = promisify(inflate);

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');

  const mockedRequest = jest.mocked(request);

  // nock cannot intercept undici.request, so the HTTP layer is mocked at the
  // undici seam; everything around it (status handling, persistence shaping,
  // compression, cloudflare detection) runs for real.
  const toBody = (content: string) => ({
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  });

  const mockUndiciResponse = (overrides: Record<string, unknown> = {}) => ({
    statusCode: 200,
    headers: { 'content-type': 'application/xml' },
    body: toBody(feedXml),
    ...overrides,
  });

  beforeEach(async () => {
    const configService = {
      getOrThrow: jest.fn(),
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

  afterEach(() => {
    // clear, not reset: the mocked undici module keeps its factory
    // implementations while call history and per-test values are dropped
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchFeedResponse', () => {
    it('does not throws when status code is non-200', async () => {
      mockedRequest.mockResolvedValue(
        mockUndiciResponse({ statusCode: 401 }) as never,
      );

      await expect(service.fetchFeedResponse(feedUrl)).resolves.toBeDefined();
    });

    it('returns the feed xml', async () => {
      mockedRequest.mockResolvedValue(mockUndiciResponse() as never);

      const res = await service.fetchFeedResponse(feedUrl);
      expect(await res.text()).toEqual(feedXml);
    });
  });

  describe('fetchAndSaveResponse', () => {
    it('uses the default user agent if no custom user agent', async () => {
      mockedRequest.mockResolvedValue(mockUndiciResponse() as never);

      await service.fetchAndSaveResponse(feedUrl);

      expect(mockedRequest).toHaveBeenCalledWith(
        feedUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'user-agent': defaultUserAgent,
          }),
        }),
      );
    });

    it('uses the explicit user agent header if provided', async () => {
      mockedRequest.mockResolvedValue(mockUndiciResponse() as never);

      await service.fetchAndSaveResponse(feedUrl, {
        lookupDetails: undefined,
        headers: { 'User-Agent': 'my-user-agent' },
        source: undefined,
      });

      expect(mockedRequest).toHaveBeenCalledWith(
        feedUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'user-agent': 'my-user-agent',
          }),
        }),
      );
    });

    describe('if ok response', () => {
      it('returns the request insert correctly', async () => {
        mockedRequest.mockResolvedValue(mockUndiciResponse() as never);

        const { request: insert, responseText } =
          await service.fetchAndSaveResponse(feedUrl);

        expect(insert).toMatchObject({
          url: feedUrl,
          lookupKey: feedUrl,
          status: RequestStatus.OK,
          fetchOptions: {
            headers: expect.objectContaining({
              'user-agent': defaultUserAgent,
            }),
          },
          response: {
            statusCode: 200,
            headers: expect.objectContaining({
              'content-type': 'application/xml',
            }),
          },
        });
        expect(responseText).toEqual(feedXml);
        expect(insert.response?.body?.hashKey).toBeDefined();
      });

      it('stores the deflated feed content', async () => {
        mockedRequest.mockResolvedValue(mockUndiciResponse() as never);

        const { request: insert } = await service.fetchAndSaveResponse(feedUrl);

        const contents = insert.response?.body?.contents;

        expect(contents).toBeDefined();

        const decoded = await inflatePromise(
          Buffer.from(contents as string, 'base64'),
        );

        expect(decoded.toString()).toEqual(feedXml);
      });
    });

    describe('if not ok response', () => {
      const feedResponseBody = {
        message: 'failed',
      };

      it('returns the request insert correctly', async () => {
        mockedRequest.mockResolvedValue(
          mockUndiciResponse({
            statusCode: 404,
            body: toBody(JSON.stringify(feedResponseBody)),
          }) as never,
        );

        const { request: insert, responseText } =
          await service.fetchAndSaveResponse(feedUrl);

        expect(insert).toMatchObject({
          url: feedUrl,
          status: RequestStatus.BAD_STATUS_CODE,
          response: {
            statusCode: 404,
          },
        });
        expect(responseText).toEqual(JSON.stringify(feedResponseBody));
      });
    });

    describe('if fetch failed', () => {
      it('returns a failed request insert correctly', async () => {
        mockedRequest.mockRejectedValue(new Error('failed'));

        const { request: insert } = await service.fetchAndSaveResponse(feedUrl);

        expect(insert).toMatchObject({
          url: feedUrl,
          status: RequestStatus.FETCH_ERROR,
          errorMessage: expect.stringContaining('failed'),
        });
      });
    });
  });
});
