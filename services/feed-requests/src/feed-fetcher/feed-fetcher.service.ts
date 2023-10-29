import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { FetchError } from 'node-fetch';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { GetFeedRequestsCountInput, GetFeedRequestsInput } from './types';
import { deflate, inflate } from 'zlib';
import { promisify } from 'util';
import { ObjectFileStorageService } from '../object-file-storage/object-file-storage.service';
import { createHash, randomUUID } from 'crypto';
import { CacheStorageService } from '../cache-storage/cache-storage.service';
import { FeedTooLargeException } from './exceptions';
import iconv from 'iconv-lite';

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);

const sha1 = createHash('sha1');

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
    private readonly objectFileStorageService: ObjectFileStorageService,
    private readonly cacheStorageService: CacheStorageService,
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
    const request = await this.requestRepo.findOne(
      {
        url,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
        populate: [],
      },
    );

    if (!request) {
      return null;
    }

    let response: Response | null = null;

    if (request.response?.id) {
      response = await this.responseRepo.findOne({
        id: request.response.id,
      });
    }

    const s3ObjectKey = response?.s3ObjectKey;
    const cacheKey = response?.redisCacheKey;

    if (response && cacheKey) {
      const compressedText = await this.cacheStorageService.getFeedHtmlContent({
        key: cacheKey,
      });

      const text = compressedText
        ? (
            await inflatePromise(Buffer.from(compressedText, 'base64'))
          ).toString()
        : '';

      return {
        ...request,
        response: {
          ...response,
          text: text,
        },
      };
    } else if (response && s3ObjectKey) {
      const compressedText =
        await this.objectFileStorageService.getFeedHtmlContent({
          key: s3ObjectKey,
        });

      return {
        ...request,
        response: {
          ...response,
          text: compressedText
            ? (
                await inflatePromise(Buffer.from(compressedText, 'base64'))
              ).toString()
            : '',
        },
      };
    } else if (response?.text && response?.hasCompressedText) {
      return {
        ...request,
        response: {
          ...response,
          text: (
            await inflatePromise(Buffer.from(response.text, 'base64'))
          ).toString(),
        },
      };
    }

    return request;
  }

  async fetchAndSaveResponse(
    url: string,
    options?: {
      flushEntities?: boolean;
      saveResponseToObjectStorage?: boolean;
    },
  ): Promise<{
    request: Request;
    responseText?: string | null;
  }> {
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
      response.text = null;

      let text: string | null = null;

      try {
        text = await this.maybeDecodeResponse(res);

        const sizeOfTextInMb = Buffer.byteLength(text) / 1024 / 1024;

        // if (sizeOfTextInMb > 3) {
        //   throw new FeedTooLargeException(`Response body is too large`);
        // }

        try {
          const deflated = await deflatePromise(text);
          const compressedText = deflated.toString('base64');
          response.text = null;

          logger.datadog('saving response', {
            url,
            byteSize: Buffer.byteLength(compressedText),
          });

          if (options?.saveResponseToObjectStorage) {
            response.s3ObjectKey = randomUUID();

            try {
              await this.objectFileStorageService.uploadFeedHtmlContent({
                key: response.s3ObjectKey,
                body: compressedText,
              });
            } catch (err) {
              logger.error(
                `Failed to upload feed hmtl content to object file storage`,
                {
                  stack: (err as Error).stack,
                },
              );
            }
          }

          response.redisCacheKey = sha1.copy().update(url).digest('hex');
          response.textHash = sha1.copy().update(text).digest('hex');

          await this.cacheStorageService.setFeedHtmlContent({
            key: response.redisCacheKey,
            body: compressedText,
          });
        } catch (err) {
          if (err instanceof FeedTooLargeException) {
            throw err;
          }

          logger.error(
            `Failed to upload feed html content for url ${url} to cache`,
            {
              stack: (err as Error).stack,
            },
          );
        }
      } catch (err) {
        if (err instanceof FeedTooLargeException) {
          request.status = RequestStatus.REFUSED_LARGE_FEED;
        } else {
          request.status = RequestStatus.PARSE_ERROR;
          logger.debug(`Failed to parse response text of url ${url}`, {
            stack: (err as Error).stack,
          });
        }
      }

      const isCloudflareServer = !!res.headers
        .get('server')
        ?.includes('cloudflare');

      response.isCloudflare = isCloudflareServer;

      await this.responseRepo.persist(response);
      request.response = response;

      await this.requestRepo.persist(request);

      return {
        request,
        responseText: text,
      };
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

      return { request };
    } finally {
      if (options?.flushEntities) {
        await this.requestRepo.flush();
      }
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

  private async maybeDecodeResponse(
    res: Awaited<ReturnType<typeof fetch>>,
  ): Promise<string> {
    const charset = res.headers
      .get('content-type')
      ?.split(';')
      .find((s) => s.includes('charset'))
      ?.split('=')[1]
      .trim();

    if (!charset || /utf-*8/i.test(charset)) {
      return res.text();
    }

    const arrBuffer = await res.arrayBuffer();
    const decoded = iconv.decode(Buffer.from(arrBuffer), charset).toString();

    return decoded;
  }
}
