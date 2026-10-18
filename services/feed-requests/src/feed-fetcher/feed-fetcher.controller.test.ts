/* eslint-disable max-len */
import dayjs from 'dayjs';
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { RequestStatus } from './constants';
import { FeedFetcherController } from './feed-fetcher.controller';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { randomUUID } from 'crypto';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

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
): PartitionedRequestInsert {
  return {
    id: randomUUID(),
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
    status,
    createdAt,
    response: statusCode ? { statusCode, textHash: null } : null,
  };
}

const createFeedFetcherServiceMock = () => ({
  fetchAndSaveResponse: mock.fn<any>(),
  getLatestRequest: mock.fn<any>(),
  getLatestRequestNon304: mock.fn<any>(),
  getRequests: mock.fn<any>(),
  getLatestRetryDate: mock.fn<any>(),
  decodeResponseContent: mock.fn<any>(async () => ''),
});

const createPartitionedRequestsStoreServiceMock = () => ({
  flushInserts: mock.fn<any>(),
  getLatestRequestAnyStatus: mock.fn<any>(),
  getLatestRequestWithResponseBody: mock.fn<any>(),
});

describe('FeedFetcherController', () => {
  let controller: FeedFetcherController;
  let feedFetcherService: ReturnType<typeof createFeedFetcherServiceMock>;
  let partitionedRequestsStoreService: ReturnType<
    typeof createPartitionedRequestsStoreServiceMock
  >;
  const url = 'https://example.com/feed.xml';

  beforeEach(() => {
    feedFetcherService = createFeedFetcherServiceMock();
    partitionedRequestsStoreService =
      createPartitionedRequestsStoreServiceMock();

    const configService = {
      getOrThrow: () => 'test-api-key',
    };

    controller = new FeedFetcherController(
      feedFetcherService as never,
      {} as never,
      configService as never,
      { getLimitForUrl: () => null } as never,
      partitionedRequestsStoreService as never,
    );
  });

  describe('fetchFeed', () => {
    describe('stale error record handling', () => {
      it('re-fetches when the only record is a stale error and executeFetchIfStale is true', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        // First call finds no request with a body; the call after the re-fetch
        // returns the new successful request
        const latestRequestResponses = [
          null,
          createMockRequest(RequestStatus.OK, new Date(), 200),
        ];
        feedFetcherService.getLatestRequest.mock.mockImplementation(
          async () => latestRequestResponses.shift() ?? null,
        );
        feedFetcherService.getLatestRequestNon304.mock.mockImplementation(
          async () =>
            createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        );

        const successInsert = createMockInsert(url, RequestStatus.OK, 200);
        feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
          async () => ({
            request: successInsert,
          }),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
        assert.strictEqual(result.requestStatus, 'SUCCESS');
      });

      it('does not re-fetch when the error record is recent', async () => {
        const recentDate = new Date();

        feedFetcherService.getLatestRequest.mock.mockImplementation(
          async () => null,
        );
        feedFetcherService.getLatestRequestNon304.mock.mockImplementation(
          async () =>
            createMockRequest(RequestStatus.BAD_STATUS_CODE, recentDate, 500),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        assert.strictEqual(
          feedFetcherService.fetchAndSaveResponse.mock.callCount(),
          0,
        );
        assert.strictEqual(result.requestStatus, 'BAD_STATUS_CODE');
      });

      it('re-fetches stale error and returns new error if feed still fails', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        feedFetcherService.getLatestRequest.mock.mockImplementation(
          async () => null,
        );

        // Stale error first; after the failed re-fetch, an error record from
        // the new attempt
        const non304Responses = [
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
          createMockRequest(RequestStatus.BAD_STATUS_CODE, new Date(), 503),
        ];
        feedFetcherService.getLatestRequestNon304.mock.mockImplementation(
          async () => non304Responses.shift() ?? null,
        );

        const failInsert = createMockInsert(
          url,
          RequestStatus.BAD_STATUS_CODE,
          503,
        );
        feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
          async () => ({
            request: failInsert,
          }),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
        assert.strictEqual(result.requestStatus, 'BAD_STATUS_CODE');
        assert.strictEqual((result as any).response.statusCode, 503);
      });

      it('does not re-fetch error records when executeFetchIfStale is false', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        feedFetcherService.getLatestRequest.mock.mockImplementation(
          async () => null,
        );
        feedFetcherService.getLatestRequestNon304.mock.mockImplementation(
          async () =>
            createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        );

        const result = await controller.fetchFeed({ url });

        assert.strictEqual(
          feedFetcherService.fetchAndSaveResponse.mock.callCount(),
          0,
        );
        assert.strictEqual(result.requestStatus, 'BAD_STATUS_CODE');
      });

      it('respects custom stalenessThresholdSeconds', async () => {
        // 10 minutes ago — stale with 5 min threshold, fresh with 30 min default
        const tenMinAgo = dayjs().subtract(10, 'minute').toDate();

        // First call finds no request with a body; the call after the re-fetch
        // returns the new successful request
        const latestRequestResponses = [
          null,
          createMockRequest(RequestStatus.OK, new Date(), 200),
        ];
        feedFetcherService.getLatestRequest.mock.mockImplementation(
          async () => latestRequestResponses.shift() ?? null,
        );
        feedFetcherService.getLatestRequestNon304.mock.mockImplementation(
          async () => createMockRequest(RequestStatus.FETCH_ERROR, tenMinAgo),
        );

        const successInsert = createMockInsert(url, RequestStatus.OK, 200);
        feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
          async () => ({
            request: successInsert,
          }),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
          stalenessThresholdSeconds: 300,
        });

        assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
        assert.strictEqual(result.requestStatus, 'SUCCESS');
      });
    });
  });

  describe('fetchFeedDeliveryPreview', () => {
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
      partitionedRequestsStoreService.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => latestRequestResponses.shift() ?? null,
      );

      const successInsert = createMockInsert(url, RequestStatus.OK, 200);
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: successInsert,
        }),
      );

      const result = await controller.fetchFeedDeliveryPreview({
        url,
        lookupKey: 'lookup-key',
        headers,
        stalenessThresholdSeconds: 120,
      });

      const [calledUrl, callOptions] =
        feedFetcherService.fetchAndSaveResponse.mock.calls[0].arguments;

      assert.strictEqual(calledUrl, url);
      assert.partialDeepStrictEqual(callOptions, {
        lookupDetails: { key: 'lookup-key' },
        headers,
      });
      assert.strictEqual(result.requestStatus, 'SUCCESS');
    });

    it('serves the fresh stored request without fetching when not stale', async () => {
      partitionedRequestsStoreService.getLatestRequestAnyStatus.mock.mockImplementation(
        async () => createMockStoredRequest(RequestStatus.OK, new Date(), 200),
      );

      const result = await controller.fetchFeedDeliveryPreview({
        url,
        lookupKey: 'lookup-key',
        stalenessThresholdSeconds: 120,
      });

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(result.requestStatus, 'SUCCESS');
    });
  });
});
