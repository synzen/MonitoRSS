/* eslint-disable max-len */
import { INestApplication } from '@nestjs/common';
import { RequestStatus } from './constants';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  clearDatabase,
  setupPostgresTests,
  teardownPostgresTests,
} from '../shared/utils/setup-postgres-tests';
import { Request, Response } from './entities';
import { EntityRepository } from '@mikro-orm/postgresql';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import dayjs from 'dayjs';
import { FeedFetcherService } from './feed-fetcher.service';
import nock from 'nock';
import path from 'path';

jest.mock('../utils/logger');

const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');

describe('FeedFetcherListenerService (Integration)', () => {
  let app: INestApplication;
  let service: FeedFetcherListenerService;
  let feedFetcherService: FeedFetcherService;
  const url = 'https://rss-feed.com/feed.xml';
  let requestRepo: EntityRepository<Request>;
  let responseRepo: EntityRepository<Response>;
  const amqpConnection = {
    publish: jest.fn(),
  };
  const failedDurationThresholdHours = 36;

  beforeAll(async () => {
    const setupData = await setupPostgresTests(
      {
        providers: [
          FeedFetcherListenerService,
          FeedFetcherService,
          {
            provide: AmqpConnection,
            useValue: amqpConnection,
          },
        ],
      },
      {
        models: [Request, Response],
      },
    );

    const { module } = await setupData.init();

    app = module.createNestApplication();
    await app.init();

    service = app.get(FeedFetcherListenerService);
    feedFetcherService = app.get(FeedFetcherService);
    service.failedDurationThresholdHours = failedDurationThresholdHours;
    requestRepo = app.get<EntityRepository<Request>>(
      getRepositoryToken(Request),
    );
    responseRepo = app.get<EntityRepository<Response>>(
      getRepositoryToken(Response),
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownPostgresTests();
  });

  describe('onBrokerFetchRequest', () => {
    it.skip('deletes stale request at the end', async () => {
      const req = new Request();
      req.url = url;
      req.status = RequestStatus.OK;
      req.createdAt = dayjs().subtract(30, 'day').toDate();

      nock(url).get('/').replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await service.onBrokerFetchRequest({
        data: {
          url,
          rateSeconds: 100,
        },
      });

      const found = await requestRepo.find({
        url,
      });
      expect(found).toHaveLength(1);

      const request = found[0];

      expect(request.createdAt.getTime()).toBeGreaterThan(
        dayjs().subtract(15, 'days').toDate().getTime(),
      );
    });

    it('saves a failed attempt with a next retry date if failed', async () => {
      nock(url).get('/').replyWithFile(404, feedFilePath, {
        'Content-Type': 'application/xml',
      });

      await service.onBrokerFetchRequest({
        data: {
          url,
          rateSeconds: 100,
        },
      });

      const request = await requestRepo.findOneOrFail({
        url,
        status: {
          $ne: RequestStatus.OK,
        },
      });

      expect(request.nextRetryDate).toBeDefined();
    });

    it('does not process the event if at failure retry count', async () => {
      const requests = Array.from({
        length: FeedFetcherListenerService.MAX_FAILED_ATTEMPTS,
      }).map(() => {
        const request = new Request();
        request.status = RequestStatus.BAD_STATUS_CODE;
        request.createdAt = dayjs().subtract(1, 'day').toDate();
        request.url = url;

        return request;
      });

      await requestRepo.persistAndFlush(requests);

      const fetchAndSaveResponse = jest.spyOn(
        feedFetcherService,
        'fetchAndSaveResponse',
      );

      await service.onBrokerFetchRequest({
        data: {
          url,
          rateSeconds: 100,
        },
      });

      expect(fetchAndSaveResponse).not.toHaveBeenCalled();
    });

    it('emits a failed url if at failure retry count', async () => {
      const requests = Array.from({
        length: FeedFetcherListenerService.MAX_FAILED_ATTEMPTS,
      }).map(() => {
        const request = new Request();
        request.status = RequestStatus.BAD_STATUS_CODE;
        request.createdAt = dayjs().subtract(1, 'day').toDate();
        request.url = url;

        return request;
      });

      await requestRepo.persistAndFlush(requests);

      await service.onBrokerFetchRequest({
        data: {
          url,
          rateSeconds: 100,
        },
      });

      expect(amqpConnection.publish).toHaveBeenCalledTimes(1);
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.failed.disable-feeds',
        {
          data: {
            url,
          },
        },
      );
    });
  });

  describe('shouldSkipAfterPreviousFailedAttempt', () => {
    const url = 'random-url';

    describe('when there were no previous attempts', () => {
      it('should return false if no previous attempt', async () => {
        const { skip, failedAttemptsCount } =
          await service.shouldSkipAfterPreviousFailedAttempt({
            url,
          });

        expect(skip).toEqual(false);
        expect(failedAttemptsCount).toEqual(0);
      });
    });

    it('should return false if latest attempt was successful', async () => {
      const request = new Request();
      request.status = RequestStatus.OK;
      request.createdAt = new Date();
      request.url = url;

      await requestRepo.persistAndFlush(request);

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url,
      });

      expect(skip).toEqual(false);
    });

    it('should skip if the found latest retry date is in the future', async () => {
      const okRequest = new Request();
      okRequest.status = RequestStatus.OK;
      okRequest.createdAt = dayjs().subtract(30, 'minutes').toDate();
      okRequest.url = url;
      const failedRequest = new Request();
      failedRequest.status = RequestStatus.FETCH_ERROR;
      failedRequest.url = url;
      failedRequest.createdAt = dayjs().subtract(20, 'minutes').toDate();
      failedRequest.nextRetryDate = dayjs().add(30, 'minutes').toDate();

      await requestRepo.persistAndFlush([okRequest, failedRequest]);

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url,
      });

      expect(skip).toEqual(true);
    });

    it('should not skip if the found latest retry date is in the past', async () => {
      const okRequest = new Request();
      okRequest.status = RequestStatus.OK;
      okRequest.createdAt = dayjs().subtract(30, 'minutes').toDate();
      okRequest.url = url;
      const failedRequest = new Request();
      failedRequest.status = RequestStatus.FETCH_ERROR;
      failedRequest.url = url;
      failedRequest.createdAt = dayjs().subtract(20, 'minutes').toDate();
      failedRequest.nextRetryDate = dayjs().subtract(10, 'minutes').toDate();

      await requestRepo.persistAndFlush([okRequest, failedRequest]);

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url,
      });

      expect(skip).toEqual(false);
    });
  });

  describe('countFailedRequests', () => {
    it('should return the number of failed requests after the latest OK attempt', async () => {
      const okRequestOlder = new Request();
      okRequestOlder.status = RequestStatus.OK;
      okRequestOlder.createdAt = dayjs().subtract(30, 'days').toDate();
      okRequestOlder.url = url;
      const failedRequestOlder = new Request();
      failedRequestOlder.status = RequestStatus.FETCH_ERROR;
      failedRequestOlder.url = url;
      failedRequestOlder.createdAt = dayjs().subtract(20, 'days').toDate();

      const okRequest = new Request();
      okRequest.status = RequestStatus.OK;
      okRequest.createdAt = dayjs().subtract(30, 'minutes').toDate();
      okRequest.url = url;
      const failedRequest = new Request();
      failedRequest.status = RequestStatus.FETCH_ERROR;
      failedRequest.url = url;
      failedRequest.createdAt = dayjs().subtract(20, 'minutes').toDate();
      const failedRequest2 = new Request();
      failedRequest2.status = RequestStatus.FETCH_ERROR;
      failedRequest2.url = url;
      failedRequest2.createdAt = dayjs().subtract(10, 'minutes').toDate();

      await requestRepo.persistAndFlush([
        okRequestOlder,
        failedRequestOlder,
        okRequest,
        failedRequest,
        failedRequest2,
      ]);

      const failedRequestsCount = await service.countFailedRequests({ url });

      expect(failedRequestsCount).toEqual(2);
    });

    it('should return 0 if there are no failed requests after the latest OK attempt', async () => {
      const okRequestOlder = new Request();
      okRequestOlder.status = RequestStatus.OK;
      okRequestOlder.createdAt = dayjs().subtract(30, 'days').toDate();
      okRequestOlder.url = url;
      const failedRequestOlder = new Request();
      failedRequestOlder.status = RequestStatus.FETCH_ERROR;
      failedRequestOlder.url = url;
      failedRequestOlder.createdAt = dayjs().subtract(20, 'days').toDate();

      const okRequest = new Request();
      okRequest.status = RequestStatus.OK;
      okRequest.createdAt = dayjs().subtract(30, 'minutes').toDate();
      okRequest.url = url;

      await requestRepo.persistAndFlush([
        okRequestOlder,
        failedRequestOlder,
        okRequest,
      ]);

      const failedRequestsCount = await service.countFailedRequests({ url });

      expect(failedRequestsCount).toEqual(0);
    });
  });

  describe('calculateNextRetryDate', () => {
    const referenceDate = new Date();

    it.each([
      {
        referenceDate,
        attemptsSoFar: 0,
        expected: dayjs(referenceDate)
          .add(
            FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES,
            'minutes',
          )
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 1,
        expected: dayjs(referenceDate)
          .add(
            FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES,
            'minutes',
          )
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 2,
        expected: dayjs(referenceDate)
          .add(
            FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES,
            'minutes',
          )
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 3,
        expected: dayjs(referenceDate)
          .add(
            FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES,
            'minutes',
          )
          .toDate(),
      },
    ])(
      'returns correctly on attempt #$attemptsSoFar' +
        ' with max $maxAttempts attempts',
      ({ referenceDate, attemptsSoFar, expected }) => {
        const returned = service.calculateNextRetryDate(
          referenceDate,
          attemptsSoFar,
        );

        expect(returned).toEqual(expected);
      },
    );
  });

  describe('requestExistsAfterTime', () => {
    it('should return true if a request exists after the given time', async () => {
      const req = new Request();
      req.status = RequestStatus.BAD_STATUS_CODE;
      req.url = url;
      req.createdAt = new Date(2020, 1, 6);

      await requestRepo.persistAndFlush(req);

      await expect(
        service.getLatestRequestAfterTime(
          {
            url,
          },
          new Date(2019, 1, 1),
        ),
      ).resolves.toBeTruthy();
    });

    it('should return true if no request exists after the given time', async () => {
      const req = new Request();
      req.status = RequestStatus.BAD_STATUS_CODE;
      req.url = url;
      req.createdAt = new Date(2020, 1, 6);

      await requestRepo.persistAndFlush(req);

      await expect(
        service.getLatestRequestAfterTime(
          {
            url,
          },
          new Date(2021, 1, 1),
        ),
      ).resolves.toBeTruthy();
    });
  });

  describe.skip('deleteStaleRequests', () => {
    it('deletes requests and their responses that are older than the threshold', async () => {
      const response = new Response();
      response.statusCode = 200;
      response.text = 'text';
      response.isCloudflare = false;

      const req1 = new Request();
      req1.status = RequestStatus.OK;
      req1.url = url;
      req1.createdAt = dayjs().subtract(15, 'day').toDate();
      req1.response = response;

      const req2 = new Request();
      req2.status = RequestStatus.OK;
      req2.url = url;
      req2.createdAt = dayjs().subtract(13, 'day').toDate();

      await requestRepo.persistAndFlush([req1, req2]);

      await service.deleteStaleRequests(url);

      const requests = await requestRepo.findAll();

      expect(requests).toHaveLength(1);
      expect(requests[0].id).toEqual(req2.id);

      const responses = await responseRepo.findAll();

      expect(responses).toHaveLength(0);
    });
  });
});
