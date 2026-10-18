import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiGuard } from './api.guard';

describe('ApiGuard', () => {
  const apiKey = 'test-api-key';
  let guard: ApiGuard;

  const configService = {
    getOrThrow: (key: string) => {
      if (key === 'FEED_REQUESTS_API_KEY') {
        return apiKey;
      }

      throw new Error(`Unexpected config key in test: ${key}`);
    },
  };

  const buildContext = (headerValue: string | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'api-key': headerValue,
          },
        }),
      }),
    }) as never;

  beforeEach(() => {
    guard = new ApiGuard(configService as never);
  });

  it('returns false if there is no api key header', () => {
    assert.strictEqual(guard.canActivate(buildContext(undefined)), false);
  });

  it('returns false if the api key header does not match the config', () => {
    assert.strictEqual(
      guard.canActivate(buildContext(apiKey + '-wrong')),
      false,
    );
  });

  it('returns true if the api key header matches the config', () => {
    assert.strictEqual(guard.canActivate(buildContext(apiKey)), true);
  });
});
