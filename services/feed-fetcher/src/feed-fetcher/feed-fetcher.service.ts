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
} from './exceptions';

@Injectable()
export class FeedFetcherService {
  constructor(
    @InjectRepository(FeedResponse)
    private readonly feedResponseRepository: Repository<FeedResponse>,
    private readonly configService: ConfigService,
  ) {}

  async fetchAndSaveResponse(url: string) {
    const xml = await this.fetchFeedXml(url);

    await this.feedResponseRepository.upsert(
      {
        url,
        xmlContent: xml,
        lastFetchAttempt: new Date(),
      },
      {
        conflictPaths: ['url'],
      },
    );
  }

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
