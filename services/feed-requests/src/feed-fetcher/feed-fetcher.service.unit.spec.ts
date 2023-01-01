import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Request, Response } from './entities';
import { RequestStatus } from './constants';
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
    persist: jest.fn(),
    findOne: jest.fn(),
  } as never;
  const responseRepo: EntityRepository<Response> = {
    persistAndFlush: jest.fn(),
    persist: jest.fn(),
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
        expect(requestRepo.persist).toHaveBeenCalledWith(
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
        expect(responseRepo.persist).toHaveBeenCalledWith(
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
        expect(requestRepo.persist).toHaveBeenCalledWith(
          expect.objectContaining({
            url: feedUrl,
            status: RequestStatus.BAD_STATUS_CODE,
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
        expect(responseRepo.persist).toHaveBeenCalledWith(
          expect.objectContaining({
            isCloudflare: true,
            statusCode: 404,
            text: JSON.stringify(feedResponseBody),
          }),
        );
      });
    });

    describe('if fetch failed', () => {
      it('saves request correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithError('failed');

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.persist).toHaveBeenCalledWith(
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

  describe('emitFailedUrl', () => {
    it('publishes the url event', () => {
      service.emitFailedUrl({ url: feedUrl });

      expect(amqpConnection.publish).toHaveBeenCalled();
    });
  });
});
