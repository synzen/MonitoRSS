import { URL } from 'node:url';
import type { CacheStorageService } from '../cache-storage/cache-storage';

interface RateLimitData {
  requestLimit: number;
  intervalSec: number;
}

const RATE_LIMITED_HOSTS = new Map<string, RateLimitData>([
  [
    'data.sec.gov',
    {
      requestLimit: 10,
      intervalSec: 2,
    },
  ],
  [
    'nasdaq.com',
    {
      requestLimit: 1,
      intervalSec: 30,
    },
  ],
]);

export interface HostRateLimiterService {
  incrementUrlCount(url: string): Promise<{ isRateLimited: boolean }>;
  getLimitForUrl(url: string): null | { host: string; data: RateLimitData };
}

export function createHostRateLimiterService(
  cacheStorageService: CacheStorageService,
): HostRateLimiterService {
  const getCacheKeyForHost = (urlHost: string) => {
    return `host-rate-limiter:${urlHost}`;
  };

  return {
    async incrementUrlCount(url) {
      const applicableLimit = this.getLimitForUrl(url);

      if (!applicableLimit) {
        return {
          isRateLimited: false,
        };
      }

      const {
        host,
        data: { intervalSec, requestLimit },
      } = applicableLimit;

      const cacheKey = getCacheKeyForHost(host);

      const newVal = await cacheStorageService.increment(cacheKey, {
        expire: {
          seconds: intervalSec,
          mode: 'NX',
        },
      });

      return {
        isRateLimited: newVal - 1 >= requestLimit,
      };
    },

    getLimitForUrl(url) {
      const host = new URL(url).host;

      const found = RATE_LIMITED_HOSTS.get(host);

      if (!found) {
        return null;
      }

      return { host, data: found };
    },
  };
}
