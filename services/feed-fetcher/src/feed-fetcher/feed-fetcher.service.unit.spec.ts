import { ConfigService } from '@nestjs/config';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { Repository } from 'typeorm';
import { Request, Response } from './entities';
import { RequestStatus } from './constants';
import { SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import dayjs from 'dayjs';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('../utils/logger');

describe('FeedFetcherService', () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const sqsClient = mockClient(SQSClient);
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const url = new URL(feedUrl);
  const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');
  const feedXml = readFileSync(feedFilePath, 'utf8');
  const requestRepo: Repository<Request> = {
    insert: jest.fn(),
    findOne: jest.fn(),
  } as never;
  const responseRepo: Repository<Response> = {
    insert: jest.fn(),
  } as never;
  const eventEmitter: EventEmitter2 = {
    emit: jest.fn(),
  } as never;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    service = new FeedFetcherService(
      requestRepo,
      responseRepo,
      configService,
      eventEmitter,
    );
    sqsClient.reset();
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
      it('saves request correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.insert).toHaveBeenCalledWith({
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
          // responseDetails: {
          //   cloudflareServer: false,
          //   statusCode: 200,
          //   responseText: feedXml,
          // },
        });
      });

      it('saves response with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(responseRepo.insert).toHaveBeenCalledWith({
          isCloudflare: true,
          statusCode: 200,
          text: feedXml,
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
        expect(requestRepo.insert).toHaveBeenCalledWith({
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
        });
      });

      it('saves response with cloudflare flag correctly', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
          Server: 'cloudflare',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(responseRepo.insert).toHaveBeenCalledWith({
          isCloudflare: true,
          statusCode: 404,
          text: JSON.stringify(feedResponseBody),
        });
      });

      it('emits a url failed event', async () => {
        nock(url.origin).get(url.pathname).reply(404, feedResponseBody, {
          'Content-Type': 'application/xml',
        });

        await service.fetchAndSaveResponse(feedUrl);
        expect(eventEmitter.emit).toHaveBeenCalledWith('failed.url', {
          url: feedUrl,
        });
      });
    });

    describe('if fetch failed', () => {
      it('saves request correctly', async () => {
        nock(url.origin).get(url.pathname).replyWithError('failed');

        await service.fetchAndSaveResponse(feedUrl);
        expect(requestRepo.insert).toHaveBeenCalledWith({
          url: feedUrl,
          status: RequestStatus.FETCH_ERROR,
          fetchOptions: {
            userAgent,
          },
          errorMessage: expect.any(String),
        });
      });
    });
  });

  describe('onFailedUrl', () => {
    it('sends the url to sqs if past failure threshold', async () => {
      jest.spyOn(service, 'isPastFailureThreshold').mockResolvedValue(true);

      const sendFailedUrlToSqs = jest
        .spyOn(service, 'sendFailedUrlToSqs')
        .mockImplementation();

      await service.onFailedUrl({ url: feedUrl });

      expect(sendFailedUrlToSqs).toHaveBeenCalledWith(feedUrl);
    });

    it('does not send the url to sqs if not past failure threshold', async () => {
      jest.spyOn(service, 'isPastFailureThreshold').mockResolvedValue(false);

      const sendFailedUrlToSqs = jest
        .spyOn(service, 'sendFailedUrlToSqs')
        .mockImplementation();

      await service.onFailedUrl({ url: feedUrl });

      expect(sendFailedUrlToSqs).not.toHaveBeenCalled();
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
      jest.spyOn(requestRepo, 'findOne').mockResolvedValue(undefined);

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

      jest
        .spyOn(service, 'getEarliestFailedAttempt')
        .mockResolvedValue(undefined);

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
