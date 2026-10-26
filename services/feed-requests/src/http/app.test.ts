/* eslint-disable max-len */
import dayjs from 'dayjs';
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createApp, type HttpAppDeps } from './app';
import { RequestStatus } from '../shared/types';

import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const API_KEY = 'test-api-key';
const url = 'https://example.com/feed.xml';

function createMockRequest(
  status: RequestStatus,
  createdAt: Date,
  statusCode?: number,
) {
  return {
    request: {
      status,
      createdAt,
      response: statusCode ? { statusCode, textHash: null } : null,
    },
    decodedResponseText: '',
  };
}

function createMockInsert(
  url: string,
  status: RequestStatus,
  statusCode?: number,
) {
  return {
    id: 'mock-id',
    status,
    source: null,
    fetchOptions: null,
    url,
    lookupKey: url,
    createdAt: new Date(),
    nextRetryDate: null,
    errorMessage: null,
    requestInitiatedAt: new Date(),
    response: statusCode
      ? {
          statusCode,
          textHash: null,
          s3ObjectKey: null,
          redisCacheKey: null,
          headers: {},
          body: null,
        }
      : null,
  };
}

function createMockStoredRequest(
  status: RequestStatus,
  createdAt: Date,
  statusCode?: number,
) {
  return {
    id: 1,
    status,
    createdAt,
    lookupKey: url,
    nextRetryDate: null,
    url,
    fetchOptions: null,
    errorMessage: null,
    response: statusCode
      ? {
          id: 1,
          statusCode,
          textHash: null,
          hasCompressedText: true,
          isCloudflare: false,
          s3ObjectKey: null,
          redisCacheKey: null,
          headers: {},
          createdAt: new Date(),
          content: null,
          responseHashKey: null,
        }
      : null,
  };
}

function createMockDeps() {
  const feedFetcher = {
    fetchAndSaveResponse: mock.fn<any>(),
    getLatestRequest: mock.fn<any>(),
    getLatestRequestNon304: mock.fn<any>(),
    getRequests: mock.fn<any>(async () => []),
    getLatestRetryDate: mock.fn<any>(async () => null),
    decodeResponseContent: mock.fn<any>(async () => ''),
  };
  const partitionedRequestsStore = {
    flushInserts: mock.fn<any>(async () => undefined),
    getLatestRequestAnyStatus: mock.fn<any>(async () => null),
    getLatestRequestWithResponseBody: mock.fn<any>(async () => null),
  };
  const hostRateLimiter = {
    getLimitForUrl: mock.fn<any>(() => null),
    incrementUrlCount: mock.fn<any>(),
  };

  const deps: HttpAppDeps = {
    apiKey: API_KEY,
    feedFetcher: feedFetcher as never,
    partitionedRequestsStore: partitionedRequestsStore as never,
    hostRateLimiter: hostRateLimiter as never,
  };

  return { deps, feedFetcher, partitionedRequestsStore, hostRateLimiter };
}

describe('HTTP app', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockDeps>;

  beforeEach(async () => {
    mocks = createMockDeps();
    app = createApp(mocks.deps);
    await app.ready();
  });

  describe('routing and auth', () => {
    it('serves the health endpoint without an api key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/feed-requests/health',
      });

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), { ok: 1 });
    });

    it('rejects requests without the api key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=10&skip=0&url=${encodeURIComponent(url)}`,
      });

      assert.strictEqual(res.statusCode, 403);
      assert.deepStrictEqual(res.json(), {
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('rejects unknown routes with the nest-style 404 body', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/nonexistent',
      });

      assert.strictEqual(res.statusCode, 404);
      assert.deepStrictEqual(res.json(), {
        statusCode: 404,
        message: 'Cannot GET /v1/nonexistent',
        error: 'Not Found',
      });
    });
  });

  describe('GET /v1/feed-requests', () => {
    it('returns the request history shape', async () => {
      const now = new Date();
      mocks.feedFetcher.getRequests.mock.mockImplementation(async () => [
        {
          id: 5,
          createdAt: now,
          finishedAt: now,
          nextRetryDate: null,
          url,
          status: RequestStatus.OK,
          fetchOptions: { headers: { 'user-agent': 'ua' } },
          response: {
            statusCode: 200,
            headers: { 'content-type': 'application/xml' },
          },
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=10&skip=0&url=${encodeURIComponent(url)}`,
        headers: { 'api-key': API_KEY },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.result.requests.length, 1);
      assert.strictEqual(body.result.requests[0].id, 5);
      assert.strictEqual(body.result.requests[0].url, url);
      assert.strictEqual(body.result.requests[0].status, RequestStatus.OK);
      assert.strictEqual(body.result.nextRetryTimestamp, null);
      assert.strictEqual(body.result.feedHostGlobalRateLimit, null);
    });

    it('includes the next retry timestamp when the latest request failed', async () => {
      const retryDate = dayjs().add(10, 'minute').toDate();
      mocks.feedFetcher.getRequests.mock.mockImplementation(async () => [
        {
          id: 1,
          createdAt: new Date(),
          finishedAt: new Date(),
          nextRetryDate: retryDate,
          url,
          status: RequestStatus.BAD_STATUS_CODE,
          fetchOptions: null,
          response: { statusCode: 500, headers: {} },
        },
      ]);
      mocks.feedFetcher.getLatestRetryDate.mock.mockImplementation(
        async () => retryDate,
      );

      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=10&skip=0&url=${encodeURIComponent(url)}`,
        headers: { 'api-key': API_KEY },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(
        res.json().result.nextRetryTimestamp,
        dayjs(retryDate).unix(),
      );
    });

    it('rejects invalid query input with a 400 list of messages', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=999&skip=0&url=${encodeURIComponent(url)}`,
        headers: { 'api-key': API_KEY },
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.statusCode, 400);
      assert.ok(Array.isArray(body.message));
      assert.ok(body.message.length > 0);
    });

    it('parses nested query objects via qs semantics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=10&skip=0&url=${encodeURIComponent(url)}&lookupKey=some-key`,
        headers: { 'api-key': API_KEY },
      });

      assert.strictEqual(res.statusCode, 200);
      const call = mocks.feedFetcher.getRequests.mock.calls[0];
      assert.deepStrictEqual(call.arguments[0], {
        limit: 10,
        skip: 0,
        url,
        lookupKey: 'some-key',
      });
    });
  });

  describe('POST /v1/feed-requests', () => {
    it('rejects a non-http url with a 400 message list', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url: 'ftp://example.com/feed.xml' },
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.statusCode, 400);
      assert.ok(Array.isArray(body.message));
      assert.ok(body.message.every((m: unknown) => typeof m === 'string'));
    });

    it('rejects an empty lookupDetails key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url, lookupDetails: { key: '' } },
      });

      assert.strictEqual(res.statusCode, 400);
    });

    it('re-fetches when the only record is a stale error and executeFetchIfStale is true', async () => {
      const staleDate = dayjs().subtract(3, 'day').toDate();

      // First call finds no request with a body; the call after the re-fetch
      // returns the new successful request
      const latestRequestResponses = [
        null,
        createMockRequest(RequestStatus.OK, new Date(), 200),
      ];
      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(
        async () => latestRequestResponses.shift() ?? null,
      );
      mocks.feedFetcher.getLatestRequestNon304.mock.mockImplementation(
        async () =>
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
      );

      const successInsert = createMockInsert(url, RequestStatus.OK, 200);
      mocks.feedFetcher.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: successInsert,
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url, executeFetchIfStale: true },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(mocks.feedFetcher.fetchAndSaveResponse.mock.callCount() > 0);
      assert.strictEqual(res.json().requestStatus, 'SUCCESS');
    });

    it('does not re-fetch when the error record is recent', async () => {
      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(
        async () => null,
      );
      mocks.feedFetcher.getLatestRequestNon304.mock.mockImplementation(
        async () =>
          createMockRequest(RequestStatus.BAD_STATUS_CODE, new Date(), 500),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url, executeFetchIfStale: true },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(
        mocks.feedFetcher.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(res.json().requestStatus, 'BAD_STATUS_CODE');
    });

    it('re-fetches stale error and returns new error if feed still fails', async () => {
      const staleDate = dayjs().subtract(3, 'day').toDate();

      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(
        async () => null,
      );

      // Stale error first; after the failed re-fetch, an error record from
      // the new attempt
      const non304Responses = [
        createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        createMockRequest(RequestStatus.BAD_STATUS_CODE, new Date(), 503),
      ];
      mocks.feedFetcher.getLatestRequestNon304.mock.mockImplementation(
        async () => non304Responses.shift() ?? null,
      );

      const failInsert = createMockInsert(
        url,
        RequestStatus.BAD_STATUS_CODE,
        503,
      );
      mocks.feedFetcher.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: failInsert,
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url, executeFetchIfStale: true },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(mocks.feedFetcher.fetchAndSaveResponse.mock.callCount() > 0);
      assert.strictEqual(res.json().requestStatus, 'BAD_STATUS_CODE');
      assert.strictEqual(res.json().response.statusCode, 503);
    });

    it('does not re-fetch error records when executeFetchIfStale is false', async () => {
      const staleDate = dayjs().subtract(3, 'day').toDate();

      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(
        async () => null,
      );
      mocks.feedFetcher.getLatestRequestNon304.mock.mockImplementation(
        async () =>
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(
        mocks.feedFetcher.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(res.json().requestStatus, 'BAD_STATUS_CODE');
    });

    it('respects custom stalenessThresholdSeconds', async () => {
      // 10 minutes ago — stale with 5 min threshold, fresh with 30 min default
      const tenMinAgo = dayjs().subtract(10, 'minute').toDate();

      const latestRequestResponses = [
        null,
        createMockRequest(RequestStatus.OK, new Date(), 200),
      ];
      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(
        async () => latestRequestResponses.shift() ?? null,
      );
      mocks.feedFetcher.getLatestRequestNon304.mock.mockImplementation(
        async () => createMockRequest(RequestStatus.FETCH_ERROR, tenMinAgo),
      );

      const successInsert = createMockInsert(url, RequestStatus.OK, 200);
      mocks.feedFetcher.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: successInsert,
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: {
          url,
          executeFetchIfStale: true,
          stalenessThresholdSeconds: 300,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(mocks.feedFetcher.fetchAndSaveResponse.mock.callCount() > 0);
      assert.strictEqual(res.json().requestStatus, 'SUCCESS');
    });

    it('returns MATCHED_HASH when the hash matches', async () => {
      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(async () => ({
        request: {
          status: RequestStatus.OK,
          createdAt: new Date(),
          response: { statusCode: 200, textHash: 'abc123' },
        },
        decodedResponseText: 'contents',
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url, hashToCompare: 'abc123' },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), {
        requestStatus: 'MATCHED_HASH',
      });
    });

    it('returns SUCCESS with the decoded body', async () => {
      mocks.feedFetcher.getLatestRequest.mock.mockImplementation(async () => ({
        request: {
          status: RequestStatus.OK,
          createdAt: new Date(),
          response: { statusCode: 200, textHash: 'abc123' },
        },
        decodedResponseText: 'feed contents',
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests',
        headers: { 'api-key': API_KEY },
        payload: { url },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), {
        requestStatus: 'SUCCESS',
        response: { hash: 'abc123', statusCode: 200, body: 'feed contents' },
      });
    });
  });

  describe('POST /v1/feed-requests/delivery-preview', () => {
    it('passes lookup key and headers through to fetchAndSaveResponse when stale', async () => {
      const staleDate = dayjs().subtract(1, 'hour').toDate();
      const headers = {
        Authorization: 'Bearer token',
        'user-agent': 'MonitoRSS:1.0',
      };

      // Stale error first; after the re-fetch, the new success is returned
      const latestRequestResponses = [
        createMockStoredRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 429),
        createMockStoredRequest(RequestStatus.OK, new Date(), 200),
      ];
      mocks.partitionedRequestsStore.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => latestRequestResponses.shift() ?? null,
      );

      const successInsert = createMockInsert(url, RequestStatus.OK, 200);
      mocks.feedFetcher.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: successInsert,
        }),
      );
      mocks.feedFetcher.decodeResponseContent.mock.mockImplementation(
        async () => 'contents',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: {
          url,
          lookupKey: 'lookup-key',
          headers,
          stalenessThresholdSeconds: 120,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const [calledUrl, callOptions] =
        mocks.feedFetcher.fetchAndSaveResponse.mock.calls[0].arguments;

      assert.strictEqual(calledUrl, url);
      assert.partialDeepStrictEqual(callOptions, {
        lookupDetails: { key: 'lookup-key' },
        headers,
      });
      assert.strictEqual(res.json().requestStatus, 'SUCCESS');
    });

    it('serves the fresh stored request without fetching when not stale', async () => {
      mocks.partitionedRequestsStore.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => createMockStoredRequest(RequestStatus.OK, new Date(), 200),
      );
      mocks.feedFetcher.decodeResponseContent.mock.mockImplementation(
        async () => 'contents',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: {
          url,
          lookupKey: 'lookup-key',
          stalenessThresholdSeconds: 120,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(
        mocks.feedFetcher.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(res.json().requestStatus, 'SUCCESS');
    });

    it('falls back to the last body-bearing request on a 304', async () => {
      mocks.partitionedRequestsStore.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => createMockStoredRequest(RequestStatus.OK, new Date(), 304),
      );
      mocks.partitionedRequestsStore.getLatestRequestWithResponseBody.mock.mockImplementation(
        async () => ({
          ...createMockStoredRequest(RequestStatus.OK, new Date(), 200),
          response: {
            ...createMockStoredRequest(RequestStatus.OK, new Date(), 200)
              .response,
            content: 'cached-body',
            textHash: 'hash-1',
          },
        }),
      );
      mocks.feedFetcher.decodeResponseContent.mock.mockImplementation(
        async () => 'cached-body',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: { url },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.requestStatus, 'SUCCESS');
      assert.strictEqual(body.response.body, 'cached-body');
    });

    it('returns FETCH_ERROR when there is no stored request and the fetch fails', async () => {
      mocks.partitionedRequestsStore.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => null,
      );
      mocks.feedFetcher.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: createMockInsert(url, RequestStatus.FETCH_ERROR),
        }),
      );
      mocks.partitionedRequestsStore.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => null,
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: { url },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), { requestStatus: 'FETCH_ERROR' });
    });
  });
});
