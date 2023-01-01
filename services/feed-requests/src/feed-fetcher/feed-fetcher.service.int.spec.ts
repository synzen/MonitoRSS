/* eslint-disable max-len */
import { INestApplication } from '@nestjs/common';
import { RequestStatus } from './constants';
import { FeedFetcherService } from './feed-fetcher.service';
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
import nock from 'nock';
import path from 'path';

jest.mock('../utils/logger');

const feedFilePath = path.join(__dirname, '..', 'test', 'data', 'feed.xml');

describe('FeedFetcherService (Integration)', () => {
  let app: INestApplication;
  let service: FeedFetcherService;
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

    service = app.get(FeedFetcherService);
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

  describe('getRequests', () => {
    it('returns correctly according to input params', async () => {
      const req = new Request();
      req.url = url;
      req.status = RequestStatus.OK;
      req.createdAt = new Date(2020);
      const re2 = new Request();
      re2.url = url;
      re2.status = RequestStatus.FAILED;
      re2.createdAt = new Date(2021);
      const re3 = new Request();
      re3.url = url;
      re3.status = RequestStatus.FAILED;
      re3.createdAt = new Date(2022);

      await requestRepo.persistAndFlush([req, re2, re3]);

      const result = await service.getRequests({
        skip: 1,
        limit: 1,
        url,
        select: ['id', 'status'],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: re2.id,
        status: re2.status,
      });
    });

    it('returns an empty array if nothing matches', async () => {
      const result = await service.getRequests({
        skip: 0,
        limit: 10,
        url,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('onBrokerFetchRequest', () => {
    it('deletes stale request at the end', async () => {
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
        length: FeedFetcherService.MAX_FAILED_ATTEMPTS,
      }).map(() => {
        const request = new Request();
        request.status = RequestStatus.FAILED;
        request.createdAt = dayjs().subtract(1, 'day').toDate();
        request.url = url;

        return request;
      });

      await requestRepo.persistAndFlush(requests);

      const fetchAndSaveResponse = jest.spyOn(service, 'fetchAndSaveResponse');

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
        length: FeedFetcherService.MAX_FAILED_ATTEMPTS,
      }).map(() => {
        const request = new Request();
        request.status = RequestStatus.FAILED;
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
          .add(FeedFetcherService.BASE_FAILED_ATTEMPT_WAIT_MINUTES, 'minutes')
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 1,
        expected: dayjs(referenceDate)
          .add(FeedFetcherService.BASE_FAILED_ATTEMPT_WAIT_MINUTES, 'minutes')
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 2,
        expected: dayjs(referenceDate)
          .add(FeedFetcherService.BASE_FAILED_ATTEMPT_WAIT_MINUTES, 'minutes')
          .toDate(),
      },
      {
        referenceDate,
        attemptsSoFar: 3,
        expected: dayjs(referenceDate)
          .add(FeedFetcherService.BASE_FAILED_ATTEMPT_WAIT_MINUTES, 'minutes')
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

  describe('getLatestRequest', () => {
    it('returns the request with the response', async () => {
      const req1 = new Request();
      req1.status = RequestStatus.FAILED;
      req1.url = url;
      req1.createdAt = new Date(2020, 1, 6);

      const response = new Response();
      response.statusCode = 200;
      response.text = 'text';
      response.isCloudflare = false;

      req1.response = response;

      await requestRepo.persistAndFlush([req1]);

      const latestRequest = await service.getLatestRequest(url);

      expect(latestRequest?.id).toEqual(req1.id);
      expect(latestRequest?.response).toMatchObject({
        statusCode: 200,
        text: 'text',
        isCloudflare: false,
      });
    });
  });

  describe('requestExistsAfterTime', () => {
    it('should return true if a request exists after the given time', async () => {
      const req = new Request();
      req.status = RequestStatus.FAILED;
      req.url = url;
      req.createdAt = new Date(2020, 1, 6);

      await requestRepo.persistAndFlush(req);

      await expect(
        service.requestExistsAfterTime(
          {
            url,
          },
          new Date(2019, 1, 1),
        ),
      ).resolves.toEqual(true);
    });

    it('should return true if no request exists after the given time', async () => {
      const req = new Request();
      req.status = RequestStatus.FAILED;
      req.url = url;
      req.createdAt = new Date(2020, 1, 6);

      await requestRepo.persistAndFlush(req);

      await expect(
        service.requestExistsAfterTime(
          {
            url,
          },
          new Date(2021, 1, 1),
        ),
      ).resolves.toEqual(false);
    });
  });

  describe('deleteStaleRequests', () => {
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
