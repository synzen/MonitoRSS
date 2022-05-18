import { RequestStatus } from './constants';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';

jest.mock('../utils/logger');

describe('FeedFetcherController', () => {
  let controller: FeedFetcherController;
  const feedFetcherService: FeedFetcherService = {
    fetchAndSaveResponse: jest.fn(),
    getLatestRequest: jest.fn(),
  } as never;

  beforeEach(() => {
    controller = new FeedFetcherController(feedFetcherService);
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
        .mockResolvedValue(undefined);

      const result = await controller.fetchFeed(data);

      expect(result).toEqual({
        requestStatus: 'pending',
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
});
