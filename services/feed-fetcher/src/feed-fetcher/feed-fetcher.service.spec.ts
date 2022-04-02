import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Repository } from 'typeorm';
import { FeedResponse } from './entities';
import { HttpStatus } from '@nestjs/common';
import {
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
} from './exceptions';

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

  describe('fetchFeedResponse', () => {
    it('throws when status code is non-200', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(401, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await expect(service.fetchFeedResponse(feedUrl)).rejects.toThrow();
    });

    it('returns the feed xml', async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      const res = await service.fetchFeedResponse(feedUrl);
      expect(await res.text()).toEqual(feedXml);
    });

    it.each([
      [HttpStatus.TOO_MANY_REQUESTS, FeedTooManyRequestsException],
      [HttpStatus.UNAUTHORIZED, FeedUnauthorizedException],
      [HttpStatus.FORBIDDEN, FeedForbiddenException],
      [HttpStatus.INTERNAL_SERVER_ERROR, FeedInternalErrorException],
      [HttpStatus.BAD_GATEWAY, FeedInternalErrorException],
      [HttpStatus.NOT_FOUND, FeedRequestException],
    ])(
      'throws the appropriate exception for status code %s',
      (statusCode, exception) => {
        nock(url.origin)
          .get(url.pathname)
          .replyWithFile(statusCode, feedFilePath, {
            'Content-Type': 'application/xml',
          });

        return expect(service.fetchFeedResponse(feedUrl)).rejects.toThrow(
          exception,
        );
      },
    );
  });

  describe('fetchAndSaveResponse', () => {
    it('passes the correct fetch options', async () => {
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
