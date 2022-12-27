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

  @RabbitSubscribe({
    exchange: '',
    queue: 'url.fetch',
  })
  async onBrokerFetchRequest(message: {
    data: { url: string; rateSeconds: number };
  }) {
    await this.handleBrokerFetchRequest(message);
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

  async fetchAndSaveResponse(url: string) {
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
        await this.onFailedUrl({ url });
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
        await this.onFailedUrl({ url });
      }

      await this.responseRepo.persistAndFlush(response);
      request.response = response;

      return this.requestRepo.persistAndFlush(request);
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });
      request.status = RequestStatus.FETCH_ERROR;
      request.errorMessage = (err as Error).message;

      return this.requestRepo.persistAndFlush(request);
    } finally {
      await this.deleteStaleRequests(url);
    }
  }

  async onFailedUrl({ url }: { url: string }) {
    try {
      const pastFailureThreshold = await this.isPastFailureThreshold(url);

      if (pastFailureThreshold) {
        logger.info(
          `Disabling feeds with url "${url}" due to failure threshold ` +
            `(${this.failedDurationThresholdHours}hrs)`,
          {
            url,
          },
        );

        await this.amqpConnection.publish<{ data: { url: string } }>(
          '',
          'url.failed.disable-feeds',
          {
            data: {
              url,
            },
          },
        );
      }
    } catch (err) {
      logger.error(`Failed to check failed status of url ${url}`, {
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

  async isPastFailureThreshold(url: string) {
    const latestRequest = await this.requestRepo.findOne(
      {
        url: url,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    if (!latestRequest || latestRequest.status === RequestStatus.OK) {
      return false;
    }

    const earliestFailedAttempt = await this.getEarliestFailedAttempt(url);

    if (!earliestFailedAttempt) {
      return false;
    }

    const earliestFailedAttemptDate = earliestFailedAttempt.createdAt;

    if (!this.isEarliestFailureDatePastThreshold(earliestFailedAttemptDate)) {
      return false;
    }

    return true;
  }

  async getEarliestFailedAttempt(url: string) {
    const latestOkRequest = await this.requestRepo.findOne(
      {
        status: RequestStatus.OK,
        url,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
        fields: ['createdAt'],
      },
    );

    if (latestOkRequest) {
      const earliestFailedRequest = await this.requestRepo.findOne(
        {
          status: {
            $ne: RequestStatus.OK,
          },
          url,
          createdAt: {
            $gt: latestOkRequest.createdAt,
          },
        },
        {
          orderBy: {
            createdAt: 'ASC',
          },
        },
      );

      return earliestFailedRequest;
    } else {
      const earliestFailedRequest = await this.requestRepo.findOne(
        {
          status: {
            $ne: RequestStatus.OK,
          },
          url,
        },
        {
          orderBy: {
            createdAt: 'ASC',
          },
        },
      );

      return earliestFailedRequest;
    }
  }

  isEarliestFailureDatePastThreshold(earliestFailureDate: Date) {
    const cutoffDate = dayjs(earliestFailureDate).add(
      this.failedDurationThresholdHours,
      'hours',
    );

    return dayjs().isAfter(cutoffDate);
  }

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

    await this.fetchAndSaveResponse(url);

    logger.debug(`Fetch request message processed for url ${url}`);
  }
}
