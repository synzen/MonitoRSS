import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { GrpcInvalidArgumentException } from '../shared/exceptions';
import { GrpcInternalException } from '../shared/exceptions/grpc-internal.exception';
import logger from '../utils/logger';
import { FetchFeedDto, FetchFeedResponseDto } from './dto';
import { FeedFetcherService } from './feed-fetcher.service';

@Controller()
export class FeedFetcherController {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

  @GrpcMethod()
  async fetchFeed(data: FetchFeedDto): Promise<FetchFeedResponseDto> {
    await this.validateFetchFeedDto(data);

    try {
      await this.feedFetcherService.fetchAndSaveResponse(data.url);

      return {
        id: '1',
      };
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
