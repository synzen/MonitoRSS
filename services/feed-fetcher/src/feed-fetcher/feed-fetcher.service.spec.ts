import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Repository } from 'typeorm';
import { FeedResponse } from './entities';

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const url = new URL(feedUrl);
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');
  const feedResponseRepository: Repository<FeedResponse> = {
    upsert: jest.fn(),
  } as never;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    service = new FeedFetcherService(feedResponseRepository, configService);
  });

  afterEach(() => {
    nock.cleanAll();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchFeed', () => {
    it('throws when status code is non-200', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(401, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await expect(service.fetchFeedXml(feedUrl)).rejects.toThrow();
    });

    it('returns the feed xml', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const xml = await service.fetchFeedXml(feedUrl);
      expect(xml).toEqual(feedXml);
    });
  });

  describe('fetchAndSaveResponse', () => {
    it('saves the response', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const nowDate = new Date(2020, 1, 20);
      jest.spyOn(global, 'Date').mockImplementation(() => nowDate as never);

      await service.fetchAndSaveResponse(feedUrl);
      expect(feedResponseRepository.upsert).toHaveBeenCalledWith(
        {
          url: feedUrl,
          xmlContent: feedXml,
          lastFetchAttempt: nowDate,
        },
        {
          conflictPaths: ['url'],
        },
      );
    });
  });
});
