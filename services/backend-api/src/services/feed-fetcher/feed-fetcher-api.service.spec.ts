import { FeedFetcherApiService } from './feed-fetcher-api.service';

describe('FeedFetcherApiService', () => {
  let service: FeedFetcherApiService;
  const apiService = {
    fetchFeed: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FeedFetcherApiService({} as never);
    service['apiService'] = apiService;
  });

  describe('fetchAndSave', () => {
    it('returns the response', async () => {
      const mockResponse = {
        requestStatus: 'error',
      };
      apiService.fetchFeed.mockResolvedValue(mockResponse);

      const response = await service.fetchAndSave('url');
      expect(response).toEqual(mockResponse);
    });

    it('calls with the correct executeFetch arg', async () => {
      apiService.fetchFeed.mockResolvedValue({});
      const url = 'url';

      await service.fetchAndSave(url, {
        getCachedResponse: true,
      });
      expect(apiService.fetchFeed).toHaveBeenCalledWith({
        url,
        executeFetch: false,
      });

      jest.resetAllMocks();

      await service.fetchAndSave(url, {
        getCachedResponse: false,
      });
      expect(apiService.fetchFeed).toHaveBeenCalledWith({
        url,
        executeFetch: true,
      });
    });
  });
});
