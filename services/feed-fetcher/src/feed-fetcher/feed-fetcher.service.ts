import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { Response } from 'node-fetch';
import {
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedInternalErrorException,
} from './exceptions';

@Injectable()
export class FeedFetcherService {
  constructor(private readonly configService: ConfigService) {}

  async fetchFeedXml(url: string) {
    const res = await this.fetchFeedResponse(url);

    return res.text();
  }

  async fetchFeedResponse(url: string): Promise<Response> {
    const userAgent = this.configService.get<string>('feedUserAgent');

    const res = await fetch(url, {
      timeout: 15000,
      follow: 5,
      headers: {
        'user-agent': userAgent || '',
      },
    });

    if (!res.ok) {
      if (res.status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new FeedTooManyRequestsException();
      } else if (res.status === HttpStatus.UNAUTHORIZED) {
        throw new FeedUnauthorizedException();
      } else if (res.status === HttpStatus.FORBIDDEN) {
        throw new FeedForbiddenException();
      } else if (res.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        throw new FeedInternalErrorException();
      } else {
        throw new FeedRequestException(`Non-200 status code (${res.status})`);
      }
    }

    return res;
  }
}
