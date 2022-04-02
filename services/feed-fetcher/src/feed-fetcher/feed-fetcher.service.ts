import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import fetch, { Response } from 'node-fetch';
import { Repository } from 'typeorm';
import { FeedResponse } from './entities';
import {
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedCloudflareException,
} from './exceptions';

interface FetchOptions {
  userAgent?: string;
}

@Injectable()
export class FeedFetcherService {
  constructor(
    @InjectRepository(FeedResponse)
    private readonly feedResponseRepository: Repository<FeedResponse>,
    private readonly configService: ConfigService,
  ) {}

  async fetchAndSaveResponse(url: string) {
    const userAgent = this.configService.get<string>('feedUserAgent');
    const res = await this.fetchFeedResponse(url, {
      userAgent,
    });

    await this.feedResponseRepository.upsert(
      {
        url,
        xmlContent: await res.text(),
        lastFetchAttempt: new Date(),
      },
      {
        conflictPaths: ['url'],
      },
    );
  }

  async fetchFeedResponse(
    url: string,
    options?: FetchOptions,
  ): Promise<Response> {
    const res = await fetch(url, {
      timeout: 15000,
      follow: 5,
      headers: {
        'user-agent': options?.userAgent || '',
      },
    });

    if (!res.ok) {
      const isCloudflare = res.headers.get('server')?.includes('cloudflare');

      if (isCloudflare) {
        throw new FeedCloudflareException();
      }

      if (res.status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new FeedTooManyRequestsException();
      }

      if (res.status === HttpStatus.UNAUTHORIZED) {
        throw new FeedUnauthorizedException();
      }

      if (res.status === HttpStatus.FORBIDDEN) {
        throw new FeedForbiddenException();
      }

      if (res.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        throw new FeedInternalErrorException();
      }

      throw new FeedRequestException(`Non-200 status code (${res.status})`);
    }

    return res;
  }
}
