import {
  NoProviderAvailableError,
  PlatformProviderFetchError,
  UnknownPlatformProviderError,
  type PlatformProviderAdapterFactoryDeps,
  type PlatformHttpGet,
  type PlatformProviderAdapter,
  type PlatformProviderRegistry,
  type PlatformProviderRouter,
  type PlatformProviderStateStore,
  type PlatformUrlMatcher,
} from './types';
import type { PlatformFeedIdentity } from './types';
import { RequestStatus } from '../feed-fetcher/types';

/**
 * Provider selection lives entirely in the registry package (its adapters
 * and defaults, with its own env surface); this config only routes a
 * matched identity to the resolved adapter.
 */
export interface PlatformProviderRouterConfig {
  matchPlatform: PlatformUrlMatcher;
  platformProviderRegistry?: PlatformProviderRegistry;
  httpGet: PlatformHttpGet;
  platformProviderStateStore?: PlatformProviderStateStore;
}

// Only fetch-failure statuses may pass the wrap — never a success-ish status.
const FAILURE_STATUSES: string[] = [
  RequestStatus.FETCH_ERROR,
  RequestStatus.PARSE_ERROR,
  RequestStatus.BAD_STATUS_CODE,
  RequestStatus.FETCH_TIMEOUT,
  RequestStatus.INVALID_SSL_CERTIFICATE,
];

/**
 * Vendor adapters cannot share this repo's error classes, so failures are
 * duck-typed and rethrown as the local PlatformProviderFetchError; unknown
 * shapes degrade to FETCH_ERROR.
 */
const wrapRegistryAdapter = (
  adapter: PlatformProviderAdapter,
): PlatformProviderAdapter => ({
  ...adapter,
  async fetchFeedDocument(identity) {
    try {
      return await adapter.fetchFeedDocument(identity);
    } catch (err) {
      if (err instanceof PlatformProviderFetchError) {
        throw err;
      }

      const failure = err as {
        requestStatus?: string;
        statusCode?: number;
        message?: string;
      };
      const message = failure.message || 'Platform provider request failed';

      if (
        failure.requestStatus &&
        FAILURE_STATUSES.includes(failure.requestStatus)
      ) {
        throw new PlatformProviderFetchError(
          message,
          failure.requestStatus as RequestStatus,
          failure.statusCode,
        );
      }

      throw new PlatformProviderFetchError(message, RequestStatus.FETCH_ERROR);
    }
  },
});

/**
 * Builds the default provider's adapter for a platform. Shared by the fetch
 * router and the release sync service, so both resolve providers the same
 * way (registry defaults + env selection).
 */
export const resolveDefaultPlatformAdapter = (
  registry: PlatformProviderRegistry | undefined,
  platform: string,
  deps: PlatformProviderAdapterFactoryDeps,
): PlatformProviderAdapter => {
  // An empty-string value is treated as unset.
  const name = registry?.defaults[platform] || undefined;

  if (!name) {
    throw new NoProviderAvailableError(
      `No provider available in this deployment for platform ${platform}`,
    );
  }

  const factory = registry?.adapters[platform]?.[name];

  if (!factory) {
    throw new UnknownPlatformProviderError(
      `Unknown platform provider "${name}" for platform ${platform}`,
    );
  }

  return wrapRegistryAdapter(factory(deps));
};

export function createPlatformProviderRouter(
  config: PlatformProviderRouterConfig,
): PlatformProviderRouter {
  return {
    route(url) {
      const identity: PlatformFeedIdentity | null = config.matchPlatform(url);

      if (!identity) {
        return null;
      }

      return {
        identity,
        adapter: resolveDefaultPlatformAdapter(
          config.platformProviderRegistry,
          identity.platform,
          {
            httpGet: config.httpGet,
            stateStore: config.platformProviderStateStore,
          },
        ),
      };
    },
  };
}
