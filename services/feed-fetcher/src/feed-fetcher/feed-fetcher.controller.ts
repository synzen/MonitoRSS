import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { FetchFeedDto, FetchFeedResponseDto } from './dto';
import { FeedFetcherService } from './feed-fetcher.service';

@Controller()
export class FeedFetcherController {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

  @GrpcMethod()
  async fetchFeed(data: FetchFeedDto): Promise<FetchFeedResponseDto> {
    console.log('got grpc data', data);

    return {
      id: '1',
    };
  }
}
