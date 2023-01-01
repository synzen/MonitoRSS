import dayjs from 'dayjs';
import { RequestStatus } from './constants';
import { GetFeedRequestsInputDto } from './dto';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';

jest.mock('../utils/logger');

describe('FeedFetcherController', () => {
  let controller: FeedFetcherController;
  const feedFetcherService: FeedFetcherService = {
    fetchAndSaveResponse: jest.fn(),
    getLatestRequest: jest.fn(),
    getRequests: jest.fn(),
    countRequests: jest.fn(),
  } as never;

  beforeEach(() => {
    controller = new FeedFetcherController(feedFetcherService);
  });

  describe('getRequests', () => {
    const input: GetFeedRequestsInputDto = {
      skip: 1,
      limit: 1,
      url: 'url',
    };

    it('returns the requests', async () => {
      const mockRequests = [
        {
          id: 1,
          createdAt: new Date(),
          nextRetryTimestamp: new Date(2022),
          status: RequestStatus.FETCH_ERROR,
        },
        {
          id: 2,
          createdAt: new Date(),
          status: RequestStatus.OK,
        },
      ];

      jest
        .spyOn(feedFetcherService, 'getRequests')
        .mockResolvedValue(mockRequests as never);

      jest.spyOn(feedFetcherService, 'countRequests').mockResolvedValue(2);

      const result = await controller.getRequests(input);

      expect(result).toEqual({
        result: {
          requests: [
            {
              id: 1,
              createdAt: dayjs(mockRequests[0].createdAt).unix(),
              status: RequestStatus.FETCH_ERROR,
            },
            {
              id: 2,
              createdAt: dayjs(mockRequests[1].createdAt).unix(),
              status: RequestStatus.OK,
            },
          ],
          totalRequests: 2,
          nextRetryTimestamp: dayjs(mockRequests[0].nextRetryTimestamp).unix(),
        },
      });
    });

    it('returns null for retry date if latest request is not failed', async () => {
      const mockRequests = [
        {
          id: 1,
          createdAt: new Date(),
          status: RequestStatus.OK,
        },
      ];

      jest
        .spyOn(feedFetcherService, 'getRequests')
        .mockResolvedValue(mockRequests as never);

      const result = await controller.getRequests(input);

      expect(result).toMatchObject({
        result: {
          nextRetryTimestamp: null,
        },
      });
    });
  });

  describe('fetchFeed', () => {
    it('runs the actual fetch if execute fetch is true', async () => {
      const data = {
        url: 'https://example.com',
        executeFetch: true,
      };

      await controller.fetchFeed(data);

      expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalledWith(
        data.url,
      );
    });

    it('returns returns pending request status if there is no latest request', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest
        .spyOn(feedFetcherService, 'getLatestRequest')
        .mockResolvedValue(null);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'pending',
      });
    });

    it('creates a new request if executeIfNotExists is true', async () => {
      const data = {
        url: 'https://www.example.com',
        executeFetchIfNotExists: true,
      };

      jest
        .spyOn(feedFetcherService, 'getLatestRequest')
        .mockResolvedValue(null);

      jest.spyOn(feedFetcherService, 'fetchAndSaveResponse').mockResolvedValue({
        status: RequestStatus.OK,
        response: {
          statusCode: 200,
        },
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toMatchObject({
        requestStatus: 'success',
      });
    });

    it('returns error if latest request is a fetch error', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: RequestStatus.FETCH_ERROR,
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'error',
      });
    });

    it('returns error if there is no response', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: RequestStatus.OK,
        response: undefined,
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'error',
      });
    });

    it('returns the response if request status was ok', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: RequestStatus.OK,
        response: {
          text: 'response body',
          statusCode: 200,
        },
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'success',
        response: {
          body: 'response body',
          statusCode: 200,
        },
      });
    });

    it('returns parse error if the latest request had a parse error', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: RequestStatus.PARSE_ERROR,
        response: {
          statusCode: 200,
        },
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'parse_error',
        response: {
          statusCode: 200,
        },
      });
    });

    it('returns request status error with response status code if request is failed', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: RequestStatus.FETCH_ERROR,
        response: {
          statusCode: 404,
        },
      } as never);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'error',
        response: {
          statusCode: 404,
        },
      });
    });

    it('throws the error if there is an unhandled status', async () => {
      const data = {
        url: 'https://www.example.com',
      };

      jest.spyOn(feedFetcherService, 'getLatestRequest').mockResolvedValue({
        status: 'unhandled',
        response: {},
      } as never);

      await expect(controller.fetchFeed(data)).rejects.toThrowError(
        'Unhandled request status: unhandled',
      );
    });
  });

  it('throws if execute fetch failed', async () => {
    const data = {
      url: 'https://example.com',
      executeFetch: true,
    };

    const error = new Error('custom error');

    jest
      .spyOn(feedFetcherService, 'fetchAndSaveResponse')
      .mockRejectedValue(error);

    await expect(controller.fetchFeed(data)).rejects.toThrow(error);
  });
});
