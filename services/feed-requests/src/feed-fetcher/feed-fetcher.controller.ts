import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  UnauthorizedException,
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
import { GrpcMethod } from '@nestjs/microservices';
import { MikroORM, UseRequestContext } from '@mikro-orm/core';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Metadata } from '@grpc/grpc-js';
import { ConfigService } from '@nestjs/config';

@Controller({
  version: '1',
})
export class FeedFetcherController {
  API_KEY: string;
  constructor(
    private readonly feedFetcherService: FeedFetcherService,
    private readonly orm: MikroORM,
    private readonly configService: ConfigService,
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
    { skip, limit, url }: GetFeedRequestsInputDto,
  ): Promise<GetFeedRequestsOutputDto> {
    const [requests, total] = await Promise.all([
      this.feedFetcherService.getRequests({
        skip,
        limit,
        url: decodeURIComponent(url),
        select: ['id', 'createdAt', 'nextRetryDate', 'status'],
      }),
      this.feedFetcherService.countRequests({
        url,
      }),
    ]);

    const nextRetryDate = requests[0]?.nextRetryDate || null;

    return {
      result: {
        requests: requests.map((r) => ({
          createdAt: dayjs(r.createdAt).unix(),
          id: r.id,
          status: r.status,
        })),
        totalRequests: total,
        // unix timestamp in seconds
        nextRetryTimestamp: nextRetryDate ? dayjs(nextRetryDate).unix() : null,
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

  @GrpcMethod('FeedFetcherGrpc', 'FetchFeed')
  @UseRequestContext()
  async fetchFeedGrpc(data: FetchFeedDto, metadata: Metadata) {
    const classData = plainToClass(FetchFeedDto, data);
    const results = validateSync(classData);

    if (results.length > 0) {
      throw new BadRequestException(results.join(','));
    }

    const auth = metadata.get('api-key')[0];

    if (auth !== this.API_KEY) {
      throw new UnauthorizedException('Invalid authorization');
    }

    return this.getLatestRequest(data);
  }

  private async getLatestRequest(data: FetchFeedDto) {
    if (data.executeFetch) {
      try {
        await this.feedFetcherService.fetchAndSaveResponse(data.url);
      } catch (err) {
        logger.error(`Failed to fetch and save response of feed ${data.url}`, {
          stack: (err as Error).stack,
        });

        throw err;
      }
    }

    let latestRequest = await this.feedFetcherService.getLatestRequest(
      data.url,
    );

    // If there's no text, response must be fetched to be cached
    if (
      !latestRequest ||
      (latestRequest.response?.redisCacheKey && !latestRequest?.response?.text)
    ) {
      if (data.executeFetchIfNotExists) {
        latestRequest = await this.feedFetcherService.fetchAndSaveResponse(
          data.url,
          {
            flushEntities: true,
          },
        );
      } else {
        return {
          requestStatus: 'PENDING' as const,
        };
      }
    }

    if (latestRequest.status === RequestStatus.FETCH_TIMEOUT) {
      return {
        requestStatus: 'FETCH_TIMEOUT' as const,
      };
    }

    if (
      latestRequest.status === RequestStatus.FETCH_ERROR ||
      !latestRequest.response
    ) {
      return {
        requestStatus: 'FETCH_ERROR' as const,
      };
    }

    if (latestRequest.status === RequestStatus.OK) {
      return {
        requestStatus: 'SUCCESS' as const,
        response: {
          body: latestRequest.response.text as string,
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.PARSE_ERROR) {
      return {
        requestStatus: 'PARSE_ERROR' as const,
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.INTERNAL_ERROR) {
      return {
        requestStatus: 'INTERNAL_ERROR' as const,
      };
    }

    if (latestRequest.status === RequestStatus.BAD_STATUS_CODE) {
      return {
        requestStatus: 'BAD_STATUS_CODE' as const,
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    throw new Error(`Unhandled request status: ${latestRequest.status}`);
  }
}
