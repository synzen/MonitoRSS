import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { MoreThan, Not, Repository } from 'typeorm';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import dayjs from 'dayjs';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { FeedsService } from '../feeds/feeds.service';

interface FetchOptions {
  userAgent?: string;
}

@Injectable()
export class FeedFetcherService {
  failedDurationThresholdHours: number;

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(Response)
    private readonly responseRepo: Repository<Response>,
    private readonly configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private readonly feedsService: FeedsService,
  ) {
    this.failedDurationThresholdHours = this.configService.get(
      'FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS',
    ) as number;
  }

  async requestExistsAfterTime(
    requestQuery: {
      url: string;
    },
    time: Date,
  ) {
    const count = await this.requestRepo.count({
      where: {
        url: requestQuery.url,
        createdAt: MoreThan(time),
      },
    });

    return count > 0;
  }

  async getLatestRequest(url: string): Promise<Request | null> {
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

      if (res.ok) {
        request.status = RequestStatus.OK;
      } else {
        request.status = RequestStatus.FAILED;
        this.eventEmitter.emit('failed.url', {
          url,
        });
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
        this.eventEmitter.emit('failed.url', {
          url,
        });
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

  @OnEvent('failed.url')
  async onFailedUrl({ url }: { url: string }) {
    try {
      if (await this.isPastFailureThreshold(url)) {
        logger.info(
          `Disabling feeds with url "${url}" due to failure threshold ` +
            `(${this.failedDurationThresholdHours}hrs)`,
          {
            url,
          },
        );
        await this.feedsService.disableFeedsByUrl(url);
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
        'user-agent': options?.userAgent || '',
      },
    });

    return res;
  }

  async isPastFailureThreshold(url: string) {
    const latestRequest = await this.requestRepo.findOne({
      where: {
        url: url,
      },
      order: {
        createdAt: 'ASC',
      },
    });

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
    const latestOkRequest = await this.requestRepo.findOne({
      where: {
        status: RequestStatus.OK,
        url,
      },
      order: {
        createdAt: 'DESC',
      },
      select: ['createdAt'],
    });

    if (latestOkRequest) {
      const earliestFailedRequest = await this.requestRepo.findOne({
        where: {
          status: RequestStatus.FAILED,
          url,
          createdAt: MoreThan(latestOkRequest.createdAt),
        },
        order: {
          createdAt: 'ASC',
        },
      });

      return earliestFailedRequest;
    } else {
      const earliestFailedRequest = await this.requestRepo.findOne({
        where: {
          status: Not(RequestStatus.OK),
          url,
        },
        order: {
          createdAt: 'ASC',
        },
      });

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

  // async sendFailedUrlToSqs(url: string) {
  //   const failedUrl = {
  //     url,
  //   };

  //   await this.failedUrlSqsClient.send(
  //     new SendMessageCommand({
  //       QueueUrl: this.failedUrlSqsQueueUrl,
  //       MessageBody: JSON.stringify(failedUrl),
  //     }),
  //   );

  //   logger.debug(`Failed url ${url} sent to SQS`, {
  //     url,
  //   });
  // }
}
