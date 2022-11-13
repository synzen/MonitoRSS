import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiGuard } from '../shared/guards';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { FetchFeedDto, FetchFeedDetailsDto } from './dto';
import { FeedFetcherService } from './feed-fetcher.service';

@Controller({
  version: '1',
})
export class FeedFetcherController {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

  @Post('requests')
  @UseGuards(ApiGuard)
  async fetchFeed(
    @Body(ValidationPipe) data: FetchFeedDto,
  ): Promise<FetchFeedDetailsDto> {
    if (data.executeFetch) {
      await this.feedFetcherService.fetchAndSaveResponse(data.url);
    }

    try {
      const latestRequest = await this.feedFetcherService.getLatestRequest(
        data.url,
      );

      if (!latestRequest) {
        return {
          requestStatus: 'pending',
        };
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

      throw new Error(`Unhandled request status: ${latestRequest.status}`);
    } catch (err) {
      logger.error(`Failed to fetch and save response of feed ${data.url}`, {
        stack: (err as Error).stack,
      });

      throw err;
    }
  }
}
