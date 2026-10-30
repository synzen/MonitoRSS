import dayjs from 'dayjs';
import logger from '../utils/logger';
import type { FeedFetcherService } from './feed-fetcher';
import type {
  FetchFeedDeliveryPreviewInput,
  FetchFeedDetails,
  FetchFeedInput,
} from './schemas';
import { RequestStatus } from './types';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';

const HTTP_STATUS_NOT_MODIFIED = 304;

const DEFAULT_STALENESS_THRESHOLD_SECONDS = 1800;

const isStaleSince = (createdAt: Date, thresholdSeconds: number) =>
  dayjs().diff(createdAt, 'second') > thresholdSeconds;

/**
 * Maps a request status and response to FetchFeedDetails.
 * Shared between delivery preview and regular feed request flows.
 */
function mapStatusToResponse(
  status: RequestStatus,
  response: { textHash?: string | null; statusCode: number } | null,
  body: string,
): FetchFeedDetails {
  if (status === RequestStatus.INVALID_SSL_CERTIFICATE) {
    return { requestStatus: 'INVALID_SSL_CERTIFICATE' as const };
  }

  if (status === RequestStatus.REFUSED_LARGE_FEED) {
    return { requestStatus: 'REFUSED_LARGE_FEED' as const };
  }

  if (status === RequestStatus.FETCH_TIMEOUT) {
    return { requestStatus: 'FETCH_TIMEOUT' as const };
  }

  if (status === RequestStatus.FETCH_ERROR || !response) {
    return { requestStatus: 'FETCH_ERROR' as const };
  }

  if (status === RequestStatus.OK) {
    return {
      requestStatus: 'SUCCESS' as const,
      response: {
        hash: response.textHash,
        body,
        statusCode: response.statusCode,
      },
    };
  }

  if (status === RequestStatus.PARSE_ERROR) {
    return {
      requestStatus: 'PARSE_ERROR' as const,
      response: { statusCode: response.statusCode },
    };
  }

  if (status === RequestStatus.INTERNAL_ERROR) {
    return { requestStatus: 'INTERNAL_ERROR' as const };
  }

  if (status === RequestStatus.BAD_STATUS_CODE) {
    return {
      requestStatus: 'BAD_STATUS_CODE' as const,
      response: { statusCode: response.statusCode },
    };
  }

  throw new Error(`Unhandled request status: ${status}`);
}

function buildFetchAndSaveOptions(data: FetchFeedInput) {
  return {
    saveResponseToObjectStorage: data.debug,
    lookupDetails: data.lookupDetails,
    source: undefined,
    headers: data.lookupDetails?.headers as Record<string, string> | undefined,
  };
}

async function fetchAndFlush(
  deps: {
    feedFetcher: Pick<FeedFetcherService, 'fetchAndSaveResponse'>;
    partitionedRequestsStore: Pick<PartitionedRequestsStore, 'flushInserts'>;
  },
  url: string,
  options?: Parameters<FeedFetcherService['fetchAndSaveResponse']>[1],
) {
  const result = await deps.feedFetcher.fetchAndSaveResponse(url, options);

  await deps.partitionedRequestsStore.flushInserts([result.request]);

  return result;
}

export interface FetchFeedFlow {
  fetchFeed(data: FetchFeedInput): Promise<FetchFeedDetails>;
  fetchFeedDeliveryPreview(
    data: FetchFeedDeliveryPreviewInput,
  ): Promise<FetchFeedDetails>;
}

export function createFetchFeedFlow({
  feedFetcher,
  partitionedRequestsStore,
}: {
  feedFetcher: Pick<
    FeedFetcherService,
    | 'fetchAndSaveResponse'
    | 'getLatestRequest'
    | 'getLatestRequestNon304'
    | 'decodeResponseContent'
  >;
  partitionedRequestsStore: Pick<
    PartitionedRequestsStore,
    | 'flushInserts'
    | 'getLatestRequestAnyStatus'
    | 'getLatestRequestWithResponseBody'
  >;
}): FetchFeedFlow {
  const deps = { feedFetcher, partitionedRequestsStore };

  async function fetchFeed(data: FetchFeedInput): Promise<FetchFeedDetails> {
    if (data.executeFetch) {
      try {
        await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));
      } catch (err) {
        logger.error(`Failed to fetch and save response of feed ${data.url}`, {
          stack: (err as Error).stack,
        });

        throw err;
      }
    }

    const lookupParams = {
      url: data.url,
      lookupKey: data.lookupDetails?.key,
    };

    let latestRequest: {
      request: {
        response: {
          textHash?: string | null;
          statusCode: number;
          redisCacheKey?: string | null;
        } | null;
        status: RequestStatus;
        createdAt: Date;
      };
      decodedResponseText?: string | null;
    } | null = await feedFetcher.getLatestRequest(lookupParams);

    const stalenessThresholdSeconds =
      data.stalenessThresholdSeconds ?? DEFAULT_STALENESS_THRESHOLD_SECONDS;
    const isStale =
      latestRequest &&
      isStaleSince(latestRequest.request.createdAt, stalenessThresholdSeconds);

    if (data.executeFetchIfStale && isStale) {
      await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));
      latestRequest = await feedFetcher.getLatestRequest(lookupParams);
    }

    // If there's no request with a response body, try to get latest non-304 request
    // (this will return errors like SSL certificate issues to the user)
    if (!latestRequest) {
      latestRequest = await feedFetcher.getLatestRequestNon304(lookupParams);

      // Check staleness on error records too - a stale error should not prevent
      // a fresh fetch attempt (e.g. a transient network error days ago)
      if (latestRequest && data.executeFetchIfStale) {
        const isErrorStale = isStaleSince(
          latestRequest.request.createdAt,
          stalenessThresholdSeconds,
        );

        if (isErrorStale) {
          await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));

          // Try to get a request with body first (in case the re-fetch succeeded)
          latestRequest = await feedFetcher.getLatestRequest(lookupParams);

          if (!latestRequest) {
            latestRequest =
              await feedFetcher.getLatestRequestNon304(lookupParams);
          }
        }
      }
    }

    // Only fetch fresh if there's no non-304 request
    // (meaning either all requests are 304, or there are no requests at all)
    if (!latestRequest) {
      const savedData = await fetchAndFlush(
        deps,
        data.url,
        buildFetchAndSaveOptions(data),
      );

      latestRequest = {
        request: { ...savedData.request },
        decodedResponseText: savedData.responseText,
      };
    }

    // Check for hash match before mapping status
    if (
      data.hashToCompare &&
      latestRequest.request.response?.textHash &&
      data.hashToCompare === latestRequest.request.response?.textHash
    ) {
      return {
        requestStatus: 'MATCHED_HASH' as const,
      };
    }

    return mapStatusToResponse(
      latestRequest.request.status,
      latestRequest.request.response,
      latestRequest.decodedResponseText ?? '',
    );
  }

  async function fetchFeedDeliveryPreview(
    data: FetchFeedDeliveryPreviewInput,
  ): Promise<FetchFeedDetails> {
    const lookupKey = data.lookupKey || data.url;

    // 1. Get latest request (any status, including errors)
    let latestRequest =
      await partitionedRequestsStore.getLatestRequestAnyStatus(lookupKey);

    // 2. Check staleness
    const threshold =
      data.stalenessThresholdSeconds ?? DEFAULT_STALENESS_THRESHOLD_SECONDS;
    const isStale =
      !latestRequest || isStaleSince(latestRequest.createdAt, threshold);

    // 3. If stale, fetch new
    if (isStale) {
      await fetchAndFlush(deps, data.url, {
        lookupDetails: data.lookupKey ? { key: data.lookupKey } : undefined,
        headers: data.headers as Record<string, string> | undefined,
        source: undefined,
      });

      // Re-fetch latest
      latestRequest =
        await partitionedRequestsStore.getLatestRequestAnyStatus(lookupKey);
    }

    // 4. Map to response
    if (!latestRequest) {
      return { requestStatus: 'FETCH_ERROR' as const };
    }

    // Check for hash match before mapping status
    if (
      data.hashToCompare &&
      latestRequest.response?.textHash &&
      data.hashToCompare === latestRequest.response.textHash
    ) {
      return { requestStatus: 'MATCHED_HASH' as const };
    }

    // Handle 304 Not Modified - get body from last successful request with content
    if (latestRequest.response?.statusCode === HTTP_STATUS_NOT_MODIFIED) {
      const lastWithBody =
        await partitionedRequestsStore.getLatestRequestWithResponseBody(
          lookupKey,
        );

      if (lastWithBody?.response?.content) {
        latestRequest = {
          ...latestRequest,
          response: {
            ...latestRequest.response,
            content: lastWithBody.response.content,
            textHash: lastWithBody.response.textHash,
          },
        };
      }
    }

    const decodedBody = await feedFetcher.decodeResponseContent(
      latestRequest.response?.content,
    );

    return mapStatusToResponse(
      latestRequest.status,
      latestRequest.response,
      decodedBody,
    );
  }

  return { fetchFeed, fetchFeedDeliveryPreview };
}
