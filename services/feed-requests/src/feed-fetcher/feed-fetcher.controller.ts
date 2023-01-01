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

@Controller({
  version: '1',
})
export class FeedFetcherController {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

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

    if (!latestRequest) {
      if (data.executeFetchIfNotExists) {
        latestRequest = await this.feedFetcherService.fetchAndSaveResponse(
          data.url,
        );
      } else {
        return {
          requestStatus: 'PENDING',
        };
      }
    }

    if (
      latestRequest.status === RequestStatus.FETCH_ERROR ||
      !latestRequest.response
    ) {
      return {
        requestStatus: 'FETCH_ERROR',
      };
    }

    if (latestRequest.status === RequestStatus.OK) {
      return {
        requestStatus: 'SUCCESS',
        response: {
          body: latestRequest.response.text as string,
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.PARSE_ERROR) {
      return {
        requestStatus: 'PARSE_ERROR',
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.INTERNAL_ERROR) {
      return {
        requestStatus: 'INTERNAL_ERROR',
      };
    }

    if (latestRequest.status === RequestStatus.BAD_STATUS_CODE) {
      return {
        requestStatus: 'BAD_STATUS_CODE',
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    throw new Error(`Unhandled request status: ${latestRequest.status}`);
  }
}
