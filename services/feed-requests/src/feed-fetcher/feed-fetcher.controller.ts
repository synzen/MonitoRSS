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

    const isFetchedOver30MinutesAgo =
      latestRequest &&
      dayjs().diff(latestRequest.request.createdAt, 'minute') > 30;

    if (data.executeFetchIfStale && isFetchedOver30MinutesAgo) {
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
    }

    // If there's no text, response must be fetched to be cached
    if (
      !latestRequest ||
      (latestRequest.request.response?.redisCacheKey &&
        latestRequest.decodedResponseText == null)
    ) {
      if (data.executeFetchIfNotExists) {
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
      } else {
        return {
          requestStatus: 'PENDING' as const,
        };
      }
    }

    const latestRequestStatus = latestRequest.request.status;
    const latestRequestResponse = latestRequest.request.response;

    if (
      data.hashToCompare &&
      latestRequest.request.response?.textHash &&
      data.hashToCompare === latestRequest.request.response?.textHash
    ) {
      return {
        requestStatus: 'MATCHED_HASH' as const,
      };
    }

    if (latestRequestStatus === RequestStatus.INVALID_SSL_CERTIFICATE) {
      return {
        requestStatus: 'INVALID_SSL_CERTIFICATE' as const,
      };
    }

    if (latestRequestStatus === RequestStatus.REFUSED_LARGE_FEED) {
      return {
        requestStatus: 'REFUSED_LARGE_FEED' as const,
      };
    }

    if (latestRequestStatus === RequestStatus.FETCH_TIMEOUT) {
      return {
        requestStatus: 'FETCH_TIMEOUT' as const,
      };
    }

    if (
      latestRequestStatus === RequestStatus.FETCH_ERROR ||
      !latestRequestResponse
    ) {
      return {
        requestStatus: 'FETCH_ERROR' as const,
      };
    }

    if (latestRequestStatus === RequestStatus.OK) {
      return {
        requestStatus: 'SUCCESS' as const,
        response: {
          hash: latestRequestResponse.textHash,
          body: latestRequest.decodedResponseText as string,
          statusCode: latestRequestResponse.statusCode,
        },
      };
    }

    if (latestRequestStatus === RequestStatus.PARSE_ERROR) {
      return {
        requestStatus: 'PARSE_ERROR' as const,
        response: {
          statusCode: latestRequestResponse.statusCode,
        },
      };
    }

    if (latestRequestStatus === RequestStatus.INTERNAL_ERROR) {
      return {
        requestStatus: 'INTERNAL_ERROR' as const,
      };
    }

    if (latestRequestStatus === RequestStatus.BAD_STATUS_CODE) {
      return {
        requestStatus: 'BAD_STATUS_CODE' as const,
        response: {
          statusCode: latestRequestResponse.statusCode,
        },
      };
    }

    throw new Error(`Unhandled request status: ${latestRequestStatus}`);
  }
}
