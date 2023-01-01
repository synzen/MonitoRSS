import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import dayjs from 'dayjs';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UseRequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';
import { GetFeedRequestsCountInput, GetFeedRequestsInput } from './types';

interface FetchOptions {
  userAgent?: string;
}

@Injectable()
export class FeedFetcherService {
  failedDurationThresholdHours: number;
  defaultUserAgent: string;

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: EntityRepository<Request>,
    @InjectRepository(Response)
    private readonly responseRepo: EntityRepository<Response>,
    private readonly configService: ConfigService,
    private readonly amqpConnection: AmqpConnection,
    private readonly orm: MikroORM, // For @UseRequestContext decorator
  ) {
    this.failedDurationThresholdHours = this.configService.get(
      'FEED_REQUESTS_FAILED_REQUEST_DURATION_THRESHOLD_HOURS',
    ) as number;
    this.defaultUserAgent = this.configService.getOrThrow(
      'FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT',
    );
  }

  static BASE_FAILED_ATTEMPT_WAIT_MINUTES = 5;
  static MAX_FAILED_ATTEMPTS = 11; // Fail feeds after 5*(2^11) minutes, or 6.25 days

  @RabbitSubscribe({
    exchange: '',
    queue: 'url.fetch',
  })
  async onBrokerFetchRequest(message: {
    data: { url: string; rateSeconds: number };
  }) {
    await this.handleBrokerFetchRequest(message);
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

  async shouldSkipAfterPreviousFailedAttempt({
    url,
  }: {
    url: string;
  }): Promise<{
    skip: boolean;
    failedAttemptsCount: number;
    nextRetryDate?: Date | null;
  }> {
    const failedAttempts = await this.countFailedRequests({ url });

    if (failedAttempts >= FeedFetcherService.MAX_FAILED_ATTEMPTS) {
      this.emitFailedUrl({ url });

      return {
        skip: true,
        failedAttemptsCount: failedAttempts,
      };
    }

    const latestNextRetryDate = await this.requestRepo.findOne(
      {
        url,
        nextRetryDate: {
          $ne: null,
        },
      },
      {
        fields: ['nextRetryDate'],
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    if (!latestNextRetryDate) {
      logger.error(
        `Request for ${url} has previously failed, but there is no` +
          ` nextRetryDate set. All failed requests handled via broker events` +
          ` should have retry dates. Continuing with request as fallback behavior.`,
      );

      return {
        skip: false,
        failedAttemptsCount: failedAttempts,
      };
    }

    if (dayjs().isBefore(latestNextRetryDate.nextRetryDate)) {
      return {
        skip: true,
        nextRetryDate: latestNextRetryDate.nextRetryDate,
        failedAttemptsCount: failedAttempts,
      };
    }

    return {
      skip: false,
      failedAttemptsCount: failedAttempts,
    };
  }

  async requestExistsAfterTime(
    requestQuery: {
      url: string;
    },
    time: Date,
  ) {
    const count = await this.requestRepo.count({
      url: requestQuery.url,
      createdAt: {
        $gt: time,
      },
    });

    return count > 0;
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

  async countFailedRequests({ url }: { url: string }): Promise<number> {
    const latestOkRequest = await this.requestRepo.findOne(
      {
        url,
        status: RequestStatus.OK,
      },
      {
        fields: ['createdAt'],
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    if (latestOkRequest) {
      return this.requestRepo.count({
        url,
        status: {
          $ne: RequestStatus.OK,
        },
        createdAt: {
          $gte: latestOkRequest.createdAt,
        },
      });
    } else {
      return this.requestRepo.count({
        url,
        status: {
          $ne: RequestStatus.OK,
        },
      });
    }
  }

  calculateNextRetryDate(referenceDate: Date, attemptsSoFar: number) {
    const minutesToWait =
      FeedFetcherService.BASE_FAILED_ATTEMPT_WAIT_MINUTES *
      Math.pow(2, attemptsSoFar);

    return dayjs(referenceDate).add(minutesToWait, 'minute').toDate();
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
        request.status = RequestStatus.FAILED;
      }

      const response = new Response();
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

      if (res.ok) {
        request.status = RequestStatus.OK;
      } else {
        request.status = RequestStatus.FAILED;
      }

      await this.responseRepo.persist(response);
      request.response = response;

      await this.requestRepo.persist(request);

      return request;
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });
      request.status = RequestStatus.FETCH_ERROR;
      request.errorMessage = (err as Error).message;

      await this.requestRepo.persist(request);

      return request;
    }
  }

  emitFailedUrl({ url }: { url: string }) {
    try {
      logger.info(
        `Disabling feeds with url "${url}" due to failure threshold ` +
          `(${this.failedDurationThresholdHours}hrs)`,
        {
          url,
        },
      );

      this.amqpConnection.publish<{ data: { url: string } }>(
        '',
        'url.failed.disable-feeds',
        {
          data: {
            url,
          },
        },
      );
    } catch (err) {
      logger.error(`Failed to publish failed url event: ${url}`, {
        stack: (err as Error).stack,
        url,
      });
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

  /**
   * While this may delete all requests of feeds that have been disabled and were not fetched
   * for a long time for example, fetches should always execute anyways if there are no
   * existing requests stored.
   */
  async deleteStaleRequests(url: string) {
    const cutoff = dayjs().subtract(14, 'days').toDate();

    try {
      const oldResponseIds = this.requestRepo
        .createQueryBuilder('a')
        .select('response')
        .where({ url, createdAt: { $lt: cutoff } })
        .getKnexQuery();

      await this.responseRepo
        .createQueryBuilder()
        .delete()
        .where({
          id: {
            $in: oldResponseIds,
          },
        });

      await this.requestRepo.nativeDelete({
        url,
        createdAt: {
          $lt: cutoff,
        },
      });
    } catch (err) {
      logger.error(`Failed to delete stale requests for url ${url}`, {
        stack: (err as Error).stack,
        url,
      });
    }
  }

  @UseRequestContext()
  private async handleBrokerFetchRequest(message: {
    data: { url: string; rateSeconds: number };
  }): Promise<void> {
    const url = message?.data?.url;
    const rateSeconds = message?.data?.rateSeconds;

    if (!url || rateSeconds == null) {
      logger.error(
        `Received fetch request message has no url and/or rateSeconds, skipping`,
        {
          message,
        },
      );

      return;
    }

    logger.debug(`Fetch request message received for url ${url}`, {
      message,
    });

    const dateToCheck = dayjs()
      .subtract(Math.round(rateSeconds * 0.75), 'seconds')
      .toDate();

    const requestExistsAfterTime = await this.requestExistsAfterTime(
      { url },
      dateToCheck,
    );

    if (requestExistsAfterTime) {
      logger.debug(
        `Request ${url} with rate ${rateSeconds} has been recently processed, skipping`,
      );

      return;
    }

    const { skip, nextRetryDate, failedAttemptsCount } =
      await this.shouldSkipAfterPreviousFailedAttempt({ url });

    if (skip) {
      logger.debug(
        `Request ${url} with rate ${rateSeconds} has ` +
          `recently failed and will be skipped until ${nextRetryDate}`,
      );
    } else {
      const latestRequest = await this.fetchAndSaveResponse(url);

      if (latestRequest.status !== RequestStatus.OK) {
        const nextRetryDate = this.calculateNextRetryDate(
          new Date(),
          failedAttemptsCount,
        );

        logger.debug(
          `Request with url ${url} failed, next retry date: ${nextRetryDate}`,
        );

        latestRequest.nextRetryDate = nextRetryDate;
        await this.requestRepo.persist(latestRequest);
      }
    }

    await this.deleteStaleRequests(url);

    await this.requestRepo.flush();
    await this.responseRepo.flush();

    logger.debug(`Fetch request message processed for url ${url}`);
  }
}
