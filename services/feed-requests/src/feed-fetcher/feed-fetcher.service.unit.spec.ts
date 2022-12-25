import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Request, Response } from './entities';
import { RequestStatus } from './constants';
import dayjs from 'dayjs';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EntityRepository } from '@mikro-orm/postgresql';
import { MikroORM } from '@mikro-orm/core';

jest.mock('../utils/logger');

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';
  const url = new URL(feedUrl);
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');
  const requestRepo: EntityRepository<Request> = {
    persistAndFlush: jest.fn(),
    findOne: jest.fn(),
  } as never;
  const responseRepo: EntityRepository<Response> = {
    persistAndFlush: jest.fn(),
  } as never;
  const amqpConnection: AmqpConnection = {
    publish: jest.fn(),
  } as never;

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    } as never;
    const mockMikroOrm = await MikroORM.init(
      {
        // Get past errors related to @UseRequestContext() decorator from MikroORM
        type: 'postgresql',
        dbName: 'test',
        entities: [],
        discovery: {
          warnWhenNoEntities: false,
        },
      },
      false,
    );

    service = new FeedFetcherService(
      requestRepo,
      responseRepo,
      configService,
      amqpConnection,
      mockMikroOrm,
    );
    service.defaultUserAgent = defaultUserAgent;
  });

  afterEach(() => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchFeedResponse', () => {
    it('does not throws when status code is non-200', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(401, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await expect(service.fetchFeedResponse(feedUrl)).resolves.toBeDefined();
    });

    it('returns the feed xml', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const res = await service.fetchFeedResponse(feedUrl);
      expect(await res.text()).toEqual(feedXml);
    });
  });

  describe('fetchAndSaveResponse', () => {
    const userAgent = 'user-agent';

    beforeEach(() => {
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'feedUserAgent') {
          return userAgent;
        }
      });
    });

    it('passes the correct fetch option to fetch feed', async () => {
      const userAgent = 'my-user-agent';
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'feedUserAgent') {
          return userAgent;
        }
      });

      nock(url.origin)
        .get(url.pathname)
        .matchHeader('user-agent', userAgent)
        .replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
        });

      await service.fetchAndSaveResponse(feedUrl);
    });

    it('uses the default user agent if no custom user agent', async () => {
      nock(url.origin)
        .get(url.pathname)
        .matchHeader('user-agent', defaultUserAgent)
        .replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
        });

      await service.fetchAndSaveResponse(feedUrl);
    });

    describe('if ok response', () => {
      it('saves request correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.persistAndFlush).toHaveBeenCalledWith(
          expect.objectContaining({
            url: feedUrl,
            status: RequestStatus.OK,
            fetchOptions: {
              userAgent,
            },
            response: {
              statusCode: 200,
              isCloudflare: false,
              text: feedXml,
            },
          }),
        );
      });

      it('saves response with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(responseRepo.persistAndFlush).toHaveBeenCalledWith(
          expect.objectContaining({
            isCloudflare: true,
            statusCode: 200,
            text: feedXml,
          }),
        );
      });
    });

    describe('if not ok response', () => {
      const feedResponseBody = {
        message: 'failed',
      };

      it('saves correctly', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.persistAndFlush).toHaveBeenCalledWith(
          expect.objectContaining({
            url: feedUrl,
            status: RequestStatus.FAILED,
            fetchOptions: {
              userAgent,
            },
            response: {
              statusCode: 404,
              isCloudflare: false,
              text: JSON.stringify(feedResponseBody),
            },
          }),
        );
      });

      it('saves response with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(responseRepo.persistAndFlush).toHaveBeenCalledWith(
          expect.objectContaining({
            isCloudflare: true,
            statusCode: 404,
            text: JSON.stringify(feedResponseBody),
          }),
        );
      });

      it('calles onFailed if bad status', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
        });

        const onFailed = jest.spyOn(service, 'onFailedUrl');

        await service.fetchAndSaveResponse(feedUrl);

        expect(onFailed).toHaveBeenCalledWith({ url: feedUrl });
      });
    });

    describe('if fetch failed', () => {
      it('saves request correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithError('failed');

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.persistAndFlush).toHaveBeenCalledWith(
          expect.objectContaining({
            url: feedUrl,
            status: RequestStatus.FETCH_ERROR,
            fetchOptions: {
              userAgent,
            },
            errorMessage: expect.any(String),
          }),
        );
      });
    });
  });

  describe('onFailedUrl', () => {
    it('publishes the url event if past failure threshold', async () => {
      jest.spyOn(service, 'isPastFailureThreshold').mockResolvedValue(true);

      await service.onFailedUrl({ url: feedUrl });

      expect(amqpConnection.publish).toHaveBeenCalled();
    });

    it('does not fail url if not past failure threshold', async () => {
      jest.spyOn(service, 'isPastFailureThreshold').mockResolvedValue(false);

      await service.onFailedUrl({ url: feedUrl });

      expect(amqpConnection.publish).not.toHaveBeenCalled();
    });

    it('does not reject if an unexpected error occurs', async () => {
      jest
        .spyOn(service, 'isPastFailureThreshold')
        .mockRejectedValue(new Error('fake-rejection'));

      await service.onFailedUrl({ url: feedUrl });
    });
  });

  describe('isEarliestFailureDatePastThreshold', () => {
    it('returns true if date is past threshold', () => {
      service.failedDurationThresholdHours = 1;
      const failedDate = dayjs().subtract(2, 'hours').toDate();

      expect(service.isEarliestFailureDatePastThreshold(failedDate)).toBe(true);
    });

    it('returns false if date is not past threshold', () => {
      service.failedDurationThresholdHours = 1;
      const failedDate = dayjs().subtract(30, 'minutes').toDate();

      expect(service.isEarliestFailureDatePastThreshold(failedDate)).toBe(
        false,
      );
    });
  });

  describe('isPastFailureThreshold', () => {
    it('returns false if there is no latest request', async () => {
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue(null);

      const result = await service.isPastFailureThreshold(feedUrl);

      expect(result).toBe(false);
    });

    it('returns false if latest request is not failed', async () => {
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue({
        status: RequestStatus.OK,
      } as never);

      const result = await service.isPastFailureThreshold(feedUrl);

      expect(result).toBe(false);
    });

    it('returns false if there is no earliest failed attempt', async () => {
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue({
        status: RequestStatus.FAILED,
      } as never);

      jest.spyOn(service, 'getEarliestFailedAttempt').mockResolvedValue(null);

      const result = await service.isPastFailureThreshold(feedUrl);

      expect(result).toBe(false);
    });

    it('returns false if earliest failure date is not past threshold', async () => {
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue({
        status: RequestStatus.FAILED,
      } as never);

      jest.spyOn(service, 'getEarliestFailedAttempt').mockResolvedValue({
        createdAt: new Date(),
      } as never);

      jest
        .spyOn(service, 'isEarliestFailureDatePastThreshold')
        .mockReturnValue(false);

      const result = await service.isPastFailureThreshold(feedUrl);

      expect(result).toBe(false);
    });

    it('returns true if earliest failure date is past threshold', async () => {
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue({
        status: RequestStatus.FAILED,
      } as never);

      jest.spyOn(service, 'getEarliestFailedAttempt').mockResolvedValue({
        createdAt: new Date(),
      } as never);

      jest
        .spyOn(service, 'isEarliestFailureDatePastThreshold')
        .mockReturnValue(true);

      const result = await service.isPastFailureThreshold(feedUrl);

      expect(result).toBe(true);
    });
  });
});
