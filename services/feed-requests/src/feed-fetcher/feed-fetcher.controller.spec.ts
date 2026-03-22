/* eslint-disable max-len */
import dayjs from 'dayjs';
import { RequestStatus } from './constants';
import { FeedFetcherController } from './feed-fetcher.controller';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { randomUUID } from 'crypto';

jest.mock('undici', () => ({ request: jest.fn() }));
jest.mock('../utils/logger');

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

describe('FeedFetcherController', () => {
  let controller: FeedFetcherController;
  let feedFetcherService: Record<string, jest.Mock>;
  let partitionedRequestsStoreService: Record<string, jest.Mock>;
  const url = 'https://example.com/feed.xml';

  beforeEach(() => {
    feedFetcherService = {
      fetchAndSaveResponse: jest.fn(),
      getLatestRequest: jest.fn(),
      getLatestRequestNon304: jest.fn(),
      getRequests: jest.fn(),
      getLatestRetryDate: jest.fn(),
      decodeResponseContent: jest.fn().mockResolvedValue(''),
    };

    partitionedRequestsStoreService = {
      flushInserts: jest.fn(),
      getLatestRequestAnyStatus: jest.fn(),
      getLatestRequestWithResponseBody: jest.fn(),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-api-key'),
    };

    controller = new FeedFetcherController(
      feedFetcherService as never,
      {} as never,
      configService as never,
      { getLimitForUrl: jest.fn().mockReturnValue(null) } as never,
      partitionedRequestsStoreService as never,
    );
  });

  describe('fetchFeed', () => {
    describe('stale error record handling', () => {
      it('re-fetches when the only record is a stale error and executeFetchIfStale is true', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValueOnce(
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        );

        const successInsert = createMockInsert(url, RequestStatus.OK, 200);
        feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
          request: successInsert,
        });

        // After re-fetch, getLatestRequest returns the new successful request
        feedFetcherService.getLatestRequest.mockResolvedValueOnce(null);
        feedFetcherService.getLatestRequest.mockResolvedValueOnce(
          createMockRequest(RequestStatus.OK, new Date(), 200),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
        expect(result.requestStatus).toBe('SUCCESS');
      });

      it('does not re-fetch when the error record is recent', async () => {
        const recentDate = new Date();

        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValue(
          createMockRequest(RequestStatus.BAD_STATUS_CODE, recentDate, 500),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
        expect(result.requestStatus).toBe('BAD_STATUS_CODE');
      });

      it('re-fetches stale error and returns new error if feed still fails', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValueOnce(
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        );

        const failInsert = createMockInsert(
          url,
          RequestStatus.BAD_STATUS_CODE,
          503,
        );
        feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
          request: failInsert,
        });

        // After re-fetch, still no successful request
        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValueOnce(
          createMockRequest(RequestStatus.BAD_STATUS_CODE, new Date(), 503),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
        });

        expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
        expect(result.requestStatus).toBe('BAD_STATUS_CODE');
        expect((result as any).response.statusCode).toBe(503);
      });

      it('does not re-fetch error records when executeFetchIfStale is false', async () => {
        const staleDate = dayjs().subtract(3, 'day').toDate();

        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValue(
          createMockRequest(RequestStatus.BAD_STATUS_CODE, staleDate, 500),
        );

        const result = await controller.fetchFeed({ url });

        expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
        expect(result.requestStatus).toBe('BAD_STATUS_CODE');
      });

      it('respects custom stalenessThresholdSeconds', async () => {
        // 10 minutes ago — stale with 5 min threshold, fresh with 30 min default
        const tenMinAgo = dayjs().subtract(10, 'minute').toDate();

        feedFetcherService.getLatestRequest.mockResolvedValue(null);
        feedFetcherService.getLatestRequestNon304.mockResolvedValueOnce(
          createMockRequest(RequestStatus.FETCH_ERROR, tenMinAgo),
        );

        const successInsert = createMockInsert(url, RequestStatus.OK, 200);
        feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
          request: successInsert,
        });
        feedFetcherService.getLatestRequest.mockResolvedValueOnce(null);
        feedFetcherService.getLatestRequest.mockResolvedValueOnce(
          createMockRequest(RequestStatus.OK, new Date(), 200),
        );

        const result = await controller.fetchFeed({
          url,
          executeFetchIfStale: true,
          stalenessThresholdSeconds: 300,
        });

        expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
        expect(result.requestStatus).toBe('SUCCESS');
      });
    });
  });
});
