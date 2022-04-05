import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import fetch, { Response } from 'node-fetch';
import { Repository } from 'typeorm';
import logger from '../utils/logger';
import { FeedResponseStatus } from './constants';
import { FeedResponse } from './entities';

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
    const fetchOptions: FetchOptions = {
      userAgent: this.configService.get<string>('feedUserAgent'),
    };

    try {
      const res = await this.fetchFeedResponse(url, fetchOptions);

      const isCloudflareServer = !!res.headers
        .get('server')
        ?.includes('cloudflare');

      let responseText: string | undefined = undefined;

      try {
        responseText = await res.text();
      } catch (err) {
        logger.debug(`Failed to parse response text of url ${url}`, {
          stack: (err as Error).stack,
        });
      }

      if (res.ok) {
        return await this.feedResponseRepository.insert({
          url,
          status: FeedResponseStatus.OK,
          fetchOptions,
          responseDetails: {
            cloudflareServer: isCloudflareServer,
            statusCode: res.status,
            responseText,
          },
        });
      } else {
        return await this.feedResponseRepository.insert({
          url,
          status: FeedResponseStatus.FAILED,
          fetchOptions,
          responseDetails: {
            cloudflareServer: isCloudflareServer,
            responseText,
            statusCode: res.status,
          },
        });
      }
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });
      return this.feedResponseRepository.insert({
        url,
        status: FeedResponseStatus.FETCH_ERROR,
        fetchOptions,
        responseDetails: {
          errorMessage: (err as Error).message,
        },
      });
    }
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

    return res;
  }
}
