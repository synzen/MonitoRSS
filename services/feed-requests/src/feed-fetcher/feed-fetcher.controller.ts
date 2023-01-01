import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
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
    const requests = await this.feedFetcherService.getRequests({
      skip,
      limit,
      url: decodeURIComponent(url),
      select: ['id', 'createdAt', 'nextRetryDate', 'status'],
    });

    const nextRetryDate = requests[0]?.nextRetryDate || null;

    return {
      result: {
        requests: requests.map((r) => ({
          createdAt: r.createdAt,
          id: r.id,
          status: r.status,
        })),
        nextRetryDate,
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
          requestStatus: 'pending',
        };
      }
    }

    if (
      latestRequest.status === RequestStatus.FETCH_ERROR ||
      !latestRequest.response
    ) {
      return {
        requestStatus: 'error',
      };
    }

    if (latestRequest.status === RequestStatus.OK) {
      return {
        requestStatus: 'success',
        response: {
          body: latestRequest.response.text as string,
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.PARSE_ERROR) {
      return {
        requestStatus: 'parse_error',
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    if (latestRequest.status === RequestStatus.FAILED) {
      return {
        requestStatus: 'error',
        response: {
          statusCode: latestRequest.response.statusCode,
        },
      };
    }

    throw new Error(`Unhandled request status: ${latestRequest.status}`);
  }
}
