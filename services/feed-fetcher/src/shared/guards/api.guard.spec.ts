import { ApiGuard } from './api.guard';

describe('ApiGuard', () => {
  const configService = {
    getOrThrow: jest.fn(),
  };
  let guard: ApiGuard;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    guard = new ApiGuard(configService as any);
    configService.getOrThrow.mockImplementation((key) => {
      if (key === 'API_KEY') {
        return apiKey;
      }

      throw new Error(`Unexpected config key in test: ${key}`);
    });
  });

  it('returns false if there is no api key header', () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'api-key': undefined,
          },
        }),
      }),
    };

    expect(guard.canActivate(context as any)).toEqual(false);
  });

  it('returns false if the api key header does not match the config', () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'api-key': apiKey + '-wrong',
          },
        }),
      }),
    };

    expect(guard.canActivate(context as any)).toEqual(false);
  });

  it('returns true if the api key header matches the config', () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'api-key': apiKey,
          },
        }),
      }),
    };

    expect(guard.canActivate(context as any)).toEqual(true);
  });
});
