import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const url = new URL(feedUrl);
  const feedFilePath = path.join(
    __dirname,
    '..',
    '..',
    'test',
    'data',
    'feed.xml',
  );

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    service = new FeedFetcherService(configService);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchFeed', () => {
    it('returns the articles and id type', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const { articles, idType } = await service.fetchFeed(feedUrl);
      expect(articles).toBeInstanceOf(Array);
      expect(typeof idType).toBe('string');
    });

    it('throws when status code is non-200', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(401, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await expect(service.fetchFeed(feedUrl)).rejects.toThrow();
    });

    it('attches id property to all the articles', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const { articles } = await service.fetchFeed(feedUrl);
      const allArticleIds = articles.map((article) => article.id);
      expect(allArticleIds.every((id) => id)).toBeTruthy();
    });
  });
});
