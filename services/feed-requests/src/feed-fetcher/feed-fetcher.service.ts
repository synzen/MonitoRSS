import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { FetchError } from 'node-fetch';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { GetFeedRequestsCountInput, GetFeedRequestsInput } from './types';

interface FetchOptions {
  userAgent?: string;
}

@Injectable()
export class FeedFetcherService {
  defaultUserAgent: string;

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: EntityRepository<Request>,
    @InjectRepository(Response)
    private readonly responseRepo: EntityRepository<Response>,
    private readonly configService: ConfigService,
  ) {
    this.defaultUserAgent = this.configService.getOrThrow(
      'FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT',
    );
  }

  async getRequests({ skip, limit, url, select }: GetFeedRequestsInput) {
    return this.requestRepo
      .createQueryBuilder()
      .select(select || '*')
      .where({
        url,
      })
      .limit(limit)
      .offset(skip)
      .orderBy({
        createdAt: 'DESC',
      })
      .execute('all', true);
  }

  async countRequests({ url }: GetFeedRequestsCountInput) {
    return this.requestRepo.count({ url });
  }

  async getLatestRequest(url: string): Promise<Request | null> {
    const response = await this.requestRepo.findOne(
      {
        url,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
        populate: ['response'],
      },
    );

    return response;
  }

  async fetchAndSaveResponse(url: string): Promise<Request> {
    const fetchOptions: FetchOptions = {
      userAgent: this.configService.get<string>('feedUserAgent'),
    };
    const request = new Request();
    request.url = url;
    request.fetchOptions = fetchOptions;

    try {
      const res = await this.fetchFeedResponse(url, fetchOptions);

      if (res.ok) {
        request.status = RequestStatus.OK;
      } else {
        request.status = RequestStatus.BAD_STATUS_CODE;
      }

      const response = new Response();
      response.createdAt = request.createdAt;
      response.statusCode = res.status;

      try {
        response.text = await res.text();
      } catch (err) {
        request.status = RequestStatus.PARSE_ERROR;
        logger.debug(`Failed to parse response text of url ${url}`, {
          stack: (err as Error).stack,
        });
      }

      const isCloudflareServer = !!res.headers
        .get('server')
        ?.includes('cloudflare');

      response.isCloudflare = isCloudflareServer;

      await this.responseRepo.persist(response);
      request.response = response;

      await this.requestRepo.persist(request);

      return request;
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });

      if (err instanceof FetchError && err.type === 'request-timeout') {
        request.status = RequestStatus.FETCH_TIMEOUT;
        request.errorMessage = err.message;
      } else {
        request.status = RequestStatus.FETCH_ERROR;
        request.errorMessage = (err as Error).message;
      }

      await this.requestRepo.persist(request);

      return request;
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
        'user-agent': options?.userAgent || this.defaultUserAgent,
      },
    });

    return res;
  }
}
