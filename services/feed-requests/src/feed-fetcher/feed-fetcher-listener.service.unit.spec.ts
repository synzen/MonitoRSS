import { ConfigService } from '@nestjs/config';
import nock from 'nock';
import { Request, Response } from './entities';
import { EntityRepository } from '@mikro-orm/postgresql';
import { MikroORM } from '@mikro-orm/core';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';

jest.mock('../utils/logger');

describe('FeedFetcherListenerService', () => {
  let service: FeedFetcherListenerService;
  let configService: ConfigService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';
  const requestRepo: EntityRepository<Request> = {
    persistAndFlush: jest.fn(),
    persist: jest.fn(),
    findOne: jest.fn(),
  } as never;
  const responseRepo: EntityRepository<Response> = {
    persistAndFlush: jest.fn(),
    persist: jest.fn(),
  } as never;
  const amqpConnection = {
    publish: jest.fn(),
  };

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

    service = new FeedFetcherListenerService(
      requestRepo,
      responseRepo,
      configService,
      {} as never,
      amqpConnection as never,
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

  describe('emitFailedUrl', () => {
    it('publishes the url event', () => {
      service.emitFailedUrl({ url: feedUrl });

      expect(amqpConnection.publish).toHaveBeenCalled();
    });
  });
});
