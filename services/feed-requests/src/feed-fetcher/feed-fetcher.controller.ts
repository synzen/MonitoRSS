/* eslint-disable max-len */
import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import dayjs from 'dayjs';
import { NestedQuery } from '../shared/decorators';
import { ApiGuard } from '../shared/guards';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import {
  FetchFeedDto,
  FetchFeedDetailsDto,
  FetchFeedDeliveryPreviewDto,
  GetFeedRequestsInputDto,
  GetFeedRequestsOutputDto,
} from './dto';
import { FeedFetcherService } from './feed-fetcher.service';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter.service';
import calculateResponseFreshnessLifetime from '../shared/utils/calculate-response-freshness-lifetime';
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';

@Controller({
  version: '1',
})
export class FeedFetcherController {
  API_KEY: string;
  constructor(
    private readonly feedFetcherService: FeedFetcherService,
    private readonly orm: MikroORM,
    private readonly configService: ConfigService,
    private readonly hostRateLimiterService: HostRateLimiterService,
    private readonly partitionedRequestsStoreService: PartitionedRequestsStoreService,
  ) {
    this.API_KEY = this.configService.getOrThrow<string>(
      'FEED_REQUESTS_API_KEY',
    );
  }

  @Get('feed-requests')
  @UseGuards(ApiGuard)
  async getRequests(
    @NestedQuery(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: GetFeedRequestsInputDto,
  ): Promise<GetFeedRequestsOutputDto> {
    const [requests] = await Promise.all([
      this.feedFetcherService.getRequests(dto),
    ]);

    const nextRetryDate =
      requests[0] && requests[0].status !== RequestStatus.OK
        ? await this.feedFetcherService.getLatestRetryDate({
            lookupKey: dto.lookupKey || dto.url,
          })
        : null;

    const globalRateLimit = this.hostRateLimiterService.getLimitForUrl(dto.url);

    return {
      result: {
        requests: requests.map((r) => ({
          createdAt: dayjs(r.createdAt).unix(),
          finishedAtIso: r.finishedAt?.toISOString(),
          createdAtIso: r.createdAt.toISOString(),
          id: r.id,
          url: r.url,
          status: r.status,
          headers: r.fetchOptions?.headers,
          response: {
            statusCode: r.response?.statusCode,
            headers: r.response?.headers,
          },
          freshnessLifetimeMs: calculateResponseFreshnessLifetime({
            headers: r.response?.headers || {},
          }).capped,
        })),
        // unix timestamp in seconds
        nextRetryTimestamp: nextRetryDate ? dayjs(nextRetryDate).unix() : null,
        feedHostGlobalRateLimit: globalRateLimit
          ? {
              intervalSec: globalRateLimit.data.intervalSec,
              requestLimit: globalRateLimit.data.requestLimit,
            }
          : null,
      },
    };
  }

  @Post('feed-requests')
  @UseGuards(ApiGuard)
  async fetchFeed(
    @Body(ValidationPipe) data: FetchFeedDto,
  ): Promise<FetchFeedDetailsDto> {
    return this.getLatestRequest(data);
  }

  @Post('feed-requests/delivery-preview')
  @UseGuards(ApiGuard)
  async fetchFeedDeliveryPreview(
    @Body(ValidationPipe) data: FetchFeedDeliveryPreviewDto,
  ): Promise<FetchFeedDetailsDto> {
    const lookupKey = data.lookupKey || data.url;

    // 1. Get latest request (any status, including errors)
    let latestRequest =
      await this.partitionedRequestsStoreService.getLatestRequestAnyStatus(
        lookupKey,
      );

    // 2. Check staleness
    const threshold = data.stalenessThresholdSeconds ?? 1800;
    const isStale =
      !latestRequest ||
      dayjs().diff(latestRequest.createdAt, 'second') > threshold;

    // 3. If stale, fetch new
    if (isStale) {
      const { request } = await this.feedFetcherService.fetchAndSaveResponse(
        data.url,
        {
          lookupDetails: data.lookupKey ? { key: data.lookupKey } : undefined,
          source: undefined,
        },
      );

      await this.partitionedRequestsStoreService.flushInserts([request]);

      // Re-fetch latest
      latestRequest =
        await this.partitionedRequestsStoreService.getLatestRequestAnyStatus(
          lookupKey,
        );
    }

    // 4. Map to response
    if (!latestRequest) {
      return { requestStatus: 'FETCH_ERROR' as const };
    }

    const decodedBody = await this.feedFetcherService.decodeResponseContent(
      latestRequest.response?.content,
    );

    return this.mapStatusToResponse(
      latestRequest.status,
      latestRequest.response,
      decodedBody,
    );
  }

  /**
   * Maps a request status and response to FetchFeedDetailsDto.
   * Shared between delivery preview and regular feed request endpoints.
   */
  private mapStatusToResponse(
    status: RequestStatus,
    response: { textHash?: string | null; statusCode: number } | null,
    body: string,
  ): FetchFeedDetailsDto {
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

  private async getLatestRequest(
    data: FetchFeedDto,
  ): Promise<FetchFeedDetailsDto> {
    if (data.executeFetch) {
      try {
        const { request } = await this.feedFetcherService.fetchAndSaveResponse(
          data.url,
          {
            saveResponseToObjectStorage: data.debug,
            lookupDetails: data.lookupDetails ? data.lookupDetails : undefined,
            source: undefined,
            headers: data.lookupDetails?.headers,
          },
        );

        await this.partitionedRequestsStoreService.flushInserts([request]);
      } catch (err) {
        logger.error(`Failed to fetch and save response of feed ${data.url}`, {
          stack: (err as Error).stack,
        });

        throw err;
      }
    }

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
    } | null = await this.feedFetcherService.getLatestRequest({
      url: data.url,
      lookupKey: data.lookupDetails?.key,
    });

    const stalenessThresholdSeconds = data.stalenessThresholdSeconds ?? 1800; // 30 min default
    const isStale =
      latestRequest &&
      dayjs().diff(latestRequest.request.createdAt, 'second') >
        stalenessThresholdSeconds;

    if (data.executeFetchIfStale && isStale) {
      const { request } = await this.feedFetcherService.fetchAndSaveResponse(
        data.url,
        {
          saveResponseToObjectStorage: data.debug,
          lookupDetails: data.lookupDetails ? data.lookupDetails : undefined,
          source: undefined,
          headers: data.lookupDetails?.headers,
        },
      );

      await this.partitionedRequestsStoreService.flushInserts([request]);

      latestRequest = await this.feedFetcherService.getLatestRequest({
        url: data.url,
        lookupKey: data.lookupDetails?.key,
      });
    }

    // If there's no text, response must be fetched to be cached
    if (!latestRequest) {
      const savedData = await this.feedFetcherService.fetchAndSaveResponse(
        data.url,
        {
          saveResponseToObjectStorage: data.debug,
          lookupDetails: data.lookupDetails,
          source: undefined,
          headers: data.lookupDetails?.headers,
        },
      );

      await this.partitionedRequestsStoreService.flushInserts([
        savedData.request,
      ]);

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

    return this.mapStatusToResponse(
      latestRequest.request.status,
      latestRequest.request.response,
      latestRequest.decodedResponseText ?? '',
    );
  }
}
