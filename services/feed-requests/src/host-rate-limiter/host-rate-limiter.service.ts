import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { CacheStorageService } from '../cache-storage/cache-storage.service';

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
]);

@Injectable()
export class HostRateLimiterService {
  constructor(private readonly cacheStorageService: CacheStorageService) {}

  async incrementUrlCount(url: string): Promise<{ isRateLimited: boolean }> {
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

    const cacheKey = this.getCacheKeyForHost(host);

    const newVal = await this.cacheStorageService.increment(cacheKey, {
      expire: {
        seconds: intervalSec,
        mode: 'NX',
      },
    });

    return {
      isRateLimited: newVal - 1 >= requestLimit,
    };
  }

  getLimitForUrl(url: string): null | { host: string; data: RateLimitData } {
    const host = new URL(url).host;

    const found = RATE_LIMITED_HOSTS.get(host);

    if (!found) {
      return null;
    }

    return { host, data: found };
  }

  private getCacheKeyForHost(urlHost: string) {
    return `host-rate-limiter:${urlHost}`;
  }
}
