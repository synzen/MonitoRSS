import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { Repository } from 'typeorm';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';

interface FetchOptions {
  userAgent?: string;
}

@Injectable()
export class FeedFetcherService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(Response)
    private readonly responseRepo: Repository<Response>,
    private readonly configService: ConfigService,
  ) {}

  async getLatestRequest(url: string): Promise<Request | undefined> {
    const response = await this.requestRepo.findOne({
      where: { url },
      order: {
        createdAt: 'DESC',
      },
      relations: ['response'],
    });

    return response;
  }

  async fetchAndSaveResponse(url: string) {
    const fetchOptions: FetchOptions = {
      userAgent: this.configService.get<string>('feedUserAgent'),
    };
    const request = new Request();
    request.url = url;
    request.fetchOptions = fetchOptions;

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

      const response = new Response();
      response.statusCode = res.status;
      response.text = responseText;
      response.isCloudflare = isCloudflareServer;

      if (res.ok) {
        request.status = RequestStatus.OK;
      } else {
        request.status = RequestStatus.FAILED;
      }

      await this.responseRepo.insert(response);
      request.response = response;

      return this.requestRepo.insert(request);
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });
      request.status = RequestStatus.FETCH_ERROR;
      request.errorMessage = (err as Error).message;

      return this.requestRepo.insert(request);
    }
  }

  async fetchFeedResponse(
    url: string,
    options?: FetchOptions,
  ): Promise<ReturnType<typeof fetch>> {
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
