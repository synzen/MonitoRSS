import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request } from './entities';
import dayjs from 'dayjs';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { MikroORM, UseRequestContext } from '@mikro-orm/core';
import { FeedFetcherService } from './feed-fetcher.service';
import { RequestSource } from './constants/request-source.constants';

interface BatchRequestMessage {
  timestamp: number;
  data: Array<{
    lookupKey?: string;
    url: string;
    saveToObjectStorage?: boolean;
  }>;
  rateSeconds: number;
}

@Injectable()
export class FeedFetcherListenerService {
  maxFailAttempts: number;
  defaultUserAgent: string;

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: EntityRepository<Request>,
    // @InjectRepository(Response)
    // private readonly responseRepo: EntityRepository<Response>,
    private readonly configService: ConfigService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly amqpConnection: AmqpConnection,
    private readonly orm: MikroORM, // For @UseRequestContext decorator
    private readonly em: EntityManager,
  ) {
    this.maxFailAttempts = this.configService.get(
      'FEED_REQUESTS_MAX_FAIL_ATTEMPTS',
    ) as number;
    this.defaultUserAgent = this.configService.getOrThrow(
      'FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT',
    );
  }

  static BASE_FAILED_ATTEMPT_WAIT_MINUTES = 5;

  @RabbitSubscribe({
    exchange: '',
    queue: 'url.fetch',
  })
  async onBrokerFetchRequest(message: {
    data: { url: string; rateSeconds: number };
  }) {
    await this.onBrokerFetchRequestHandler(message);
  }

  @RabbitSubscribe({
    exchange: '',
    queue: 'url.fetch-batch',
    queueOptions: {
      channel: 'fetchBatch',
    },
    createQueueIfNotExists: true,
  })
  async onBrokerFetchRequestBatch(message: BatchRequestMessage) {
    logger.datadog(`Received fetch batch request message`, {
      event: message,
    });
    await this.onBrokerFetchRequestBatchHandler(message);
  }

  @UseRequestContext()
  private async onBrokerFetchRequestHandler(message: {
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

    logger.debug(`Fetch request message received for url ${url}`);

    await this.em.flush();

    logger.debug(`Fetch request message processed for url ${url}`);
  }

  @UseRequestContext()
  private async onBrokerFetchRequestBatchHandler(
    message: BatchRequestMessage,
  ): Promise<void> {
    const urls = message?.data?.map((u) => u.url);
    const rateSeconds = message?.rateSeconds;

    if (!message.data || rateSeconds == null) {
      logger.error(
        `Received fetch batch request message has no urls and/or rateSeconds, skipping`,
        {
          event: message,
        },
      );

      return;
    }

    logger.debug(`Fetch batch request message received for batch urls`, {
      event: message,
    });

    try {
      const results = await Promise.allSettled(
        message.data.map(async ({ url, lookupKey, saveToObjectStorage }) => {
          let request: Request | undefined = undefined;

          try {
            const result = await this.handleBrokerFetchRequest({
              lookupKey,
              url,
              rateSeconds,
              saveToObjectStorage,
            });

            if (result) {
              request = result.request;
            }

            if (result?.request.status === RequestStatus.OK) {
              await this.emitFetchCompleted({
                lookupKey,
                url,
                rateSeconds: rateSeconds,
              });
            }
          } finally {
            if (message.timestamp) {
              const nowTs = Date.now();
              const finishedTs = nowTs - message.timestamp;

              logger.datadog(
                `Finished handling feed requests batch event URL in ${finishedTs}s`,
                {
                  duration: finishedTs,
                  url,
                  lookupKey,
                  requestStatus: request?.status,
                  errorMessage: request?.errorMessage,
                },
              );
            }
          }
        }),
      );

      for (let i = 0; i < results.length; ++i) {
        const res = results[i];

        if (res.status === 'fulfilled') {
          continue;
        }

        logger.error(`Error processing a message within batch request`, {
          reason: res.reason instanceof Error ? res.reason.stack : res.reason,
        });
      }

      await this.em.flush();

      logger.debug(`Fetch batch request message processed for urls`, {
        urls,
      });
    } catch (err) {
      logger.error(`Error processing fetch batch request message`, {
        event: message,
        err: (err as Error).stack,
      });
    }
  }

  private async handleBrokerFetchRequest(data: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
    saveToObjectStorage?: boolean;
  }): Promise<undefined | { request: Request }> {
    const url = data.url;
    const rateSeconds = data.rateSeconds;
    const lookupKey = data.lookupKey;

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
      await this.shouldSkipAfterPreviousFailedAttempt({
        lookupKey: lookupKey || url,
        url,
      });

    if (skip) {
      logger.debug(
        `Request ${url} with rate ${rateSeconds} has ` +
          `recently failed and will be skipped until ${nextRetryDate}`,
      );
    } else {
      const { request } = await this.feedFetcherService.fetchAndSaveResponse(
        url,
        {
          saveResponseToObjectStorage: data.saveToObjectStorage,
          lookupKey,
          source: RequestSource.Schedule,
        },
      );

      if (request.status === RequestStatus.REFUSED_LARGE_FEED) {
        this.emitRejectedUrl({ url });
      } else if (request.status !== RequestStatus.OK) {
        const nextRetryDate = this.calculateNextRetryDate(
          new Date(),
          failedAttemptsCount,
        );

        this.emitFailingUrl({ lookupKey, url });

        logger.debug(
          `Request with url ${url} failed, next retry date: ${nextRetryDate}`,
        );

        request.nextRetryDate = nextRetryDate;
      }

      return { request };
    }

    // await this.deleteStaleRequests(url);
  }

  async shouldSkipAfterPreviousFailedAttempt({
    lookupKey,
    url,
  }: {
    lookupKey?: string;
    url: string;
  }): Promise<{
    skip: boolean;
    failedAttemptsCount: number;
    nextRetryDate?: Date | null;
  }> {
    const failedAttempts = await this.countFailedRequests({
      lookupKey: lookupKey || url,
      url,
    });

    if (failedAttempts === 0) {
      return {
        skip: false,
        failedAttemptsCount: 0,
      };
    }

    if (failedAttempts >= this.maxFailAttempts) {
      this.emitFailedUrl({ lookupKey, url });

      return {
        skip: true,
        failedAttemptsCount: failedAttempts,
      };
    }

    const latestNextRetryDate = await this.requestRepo.findOne(
      {
        lookupKey: lookupKey || url,
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
        `Request for ${lookupKey} has previously failed, but there is no` +
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

  emitRejectedUrl({ url }: { url: string }) {
    try {
      logger.info(`Emitting rejected url for feeds with url "${url}" `, {
        url,
      });

      this.amqpConnection.publish<{
        data: { url: string; status: RequestStatus };
      }>('', 'url.rejected.disable-feeds', {
        data: {
          url,
          status: RequestStatus.REFUSED_LARGE_FEED,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish rejected url event: ${url}`, {
        stack: (err as Error).stack,
        url,
      });
    }
  }

  emitFailedUrl({ lookupKey, url }: { lookupKey?: string; url: string }) {
    try {
      logger.info(
        `Disabling feeds with lookup key "${lookupKey}" due to failure threshold `,
      );

      this.amqpConnection.publish<{
        data: { lookupKey?: string; url: string };
      }>('', 'url.failed.disable-feeds', {
        data: {
          lookupKey,
          url,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish failed url event: ${lookupKey}`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  emitFailingUrl({ lookupKey, url }: { lookupKey?: string; url: string }) {
    try {
      this.amqpConnection.publish<{
        data: { lookupKey?: string; url: string };
      }>('', 'url.failing', {
        data: {
          lookupKey,
          url,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish failing lookup key event`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  emitFetchCompleted({
    lookupKey,
    url,
    rateSeconds,
  }: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
  }) {
    try {
      this.amqpConnection.publish<{
        data: { lookupKey?: string; url: string; rateSeconds: number };
      }>('', 'url.fetch.completed', {
        data: {
          lookupKey,
          url,
          rateSeconds,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish fetch completed event: ${lookupKey}`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  async countFailedRequests({
    lookupKey,
    url,
  }: {
    lookupKey?: string;
    url: string;
  }): Promise<number> {
    const latestOkRequest = await this.requestRepo.findOne(
      {
        lookupKey: lookupKey || url,
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
        lookupKey: lookupKey || url,
        status: {
          $ne: RequestStatus.OK,
        },
        createdAt: {
          $gte: latestOkRequest.createdAt,
        },
        source: RequestSource.Schedule,
      });
    } else {
      return this.requestRepo.count({
        lookupKey: lookupKey || url,
        status: {
          $ne: RequestStatus.OK,
        },
        source: RequestSource.Schedule,
      });
    }
  }

  calculateNextRetryDate(referenceDate: Date, attemptsSoFar: number) {
    const minutesToWait =
      FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES *
      Math.pow(2, attemptsSoFar);

    return dayjs(referenceDate).add(minutesToWait, 'minute').toDate();
  }

  async requestExistsAfterTime(
    requestQuery: {
      lookupKey?: string;
      url: string;
    },
    time: Date,
  ) {
    const found = await this.requestRepo.findOne(
      {
        lookupKey: requestQuery.lookupKey || requestQuery.url,
        createdAt: {
          $gt: time,
        },
        source: RequestSource.Schedule,
      },
      {
        fields: ['id'],
      },
    );

    return !!found;
  }

  /**
   * While this may delete all requests of feeds that have been disabled and were not fetched
   * for a long time for example, fetches should always execute anyways if there are no
   * existing requests stored.
   */
  async deleteStaleRequests(url: string) {
    const cutoff = dayjs().subtract(1, 'days').toDate();

    // const staleRequestsExists = await this.requestRepo.findOne(
    //   {
    //     url,
    //     createdAt: {
    //       $lt: cutoff,
    //     },
    //   },
    //   {
    //     fields: ['id'],
    //   },
    // );

    // if (!staleRequestsExists) {
    //   return;
    // }

    try {
      // const oldResponseIds = this.requestRepo
      //   .createQueryBuilder('a')
      //   .select('response')
      //   .where({ url, createdAt: { $lt: cutoff } })
      //   .getKnexQuery();
      // await this.responseRepo
      //   .createQueryBuilder()
      //   .delete()
      //   .where({
      //     id: {
      //       $in: oldResponseIds,
      //     },
      //   });
      // await this.requestRepo.nativeDelete({
      //   url,
      //   createdAt: {
      //     $lt: cutoff,
      //   },
      // });
    } catch (err) {
      logger.error(`Failed to delete stale requests for url ${url}`, {
        stack: (err as Error).stack,
        url,
      });
    }
  }
}
