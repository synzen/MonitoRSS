import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { GrpcInvalidArgumentException } from '../shared/exceptions';
import { GrpcInternalException } from '../shared/exceptions/grpc-internal.exception';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { FetchFeedDto, FetchFeedDetailsDto } from './dto';
import { FeedFetcherService } from './feed-fetcher.service';

@Controller()
export class FeedFetcherController {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

  @GrpcMethod()
  async fetchFeed(data: FetchFeedDto): Promise<FetchFeedDetailsDto> {
    await this.validateFetchFeedDto(data);

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
            body: latestRequest.response.text || '',
            statusCode: latestRequest.response.statusCode,
          },
        };
      }

      throw new Error(`Unhandled request status: ${latestRequest.status}`);
    } catch (err) {
      logger.error(`Failed to fetch and save response of feed ${data.url}`, {
        stack: (err as Error).stack,
      });

      throw new GrpcInternalException();
    }
  }

  private async validateFetchFeedDto(data: FetchFeedDto) {
    const dto = new FetchFeedDto();
    dto.url = data.url;

    const errors = await validate(dto);

    if (errors.length > 0) {
      logger.error(`Invalid arguments received for fetchFeed`, {
        errors,
      });

      const basicErrorMessage = errors
        .map((e) => Object.values(e.constraints || {}).join(','))
        .join(',');

      throw new GrpcInvalidArgumentException(basicErrorMessage);
    }
  }
}
