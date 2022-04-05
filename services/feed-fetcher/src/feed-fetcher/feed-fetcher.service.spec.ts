import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Repository } from 'typeorm';
import { FeedResponse } from './entities';

import { FeedResponseStatus } from './constants';

jest.mock('../utils/logger')

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const url = new URL(feedUrl);
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');
  const feedResponseRepository: Repository<FeedResponse> = {
    insert: jest.fn(),
  } as never;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    service = new FeedFetcherService(feedResponseRepository, configService);
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

    describe('if ok response', () => {
      it('saves correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(feedResponseRepository.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: FeedResponseStatus.OK,
          fetchOptions: {
            userAgent,
          },
          responseDetails: {
            cloudflareServer: false,
            statusCode: 200,
            responseText: feedXml,
          },
        });
      });

      it('saves with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(feedResponseRepository.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: FeedResponseStatus.OK,
          fetchOptions: {
            userAgent,
          },
          responseDetails: {
            cloudflareServer: true,
            statusCode: 200,
            responseText: feedXml,
          },
        });
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
        expect(feedResponseRepository.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: FeedResponseStatus.FAILED,
          fetchOptions: {
            userAgent,
          },
          responseDetails: {
            cloudflareServer: false,
            statusCode: 404,
            responseText: JSON.stringify(feedResponseBody),
          },
        });
      });

      it('saves with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(feedResponseRepository.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: FeedResponseStatus.FAILED,
          fetchOptions: {
            userAgent,
          },
          responseDetails: {
            cloudflareServer: true,
            statusCode: 404,
            responseText: JSON.stringify(feedResponseBody),
          },
        });
      });
    });

    describe('if fetch failed', () => {
      it('saves correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithError('failed');

        await service.fetchAndSaveResponse(feedUrl);
        expect(feedResponseRepository.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: FeedResponseStatus.FETCH_ERROR,
          fetchOptions: {
            userAgent,
          },
          responseDetails: {
            errorMessage: expect.any(String),
          },
        });
      });
    });
  });
});
