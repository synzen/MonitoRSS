import { Module } from '@nestjs/common';
import { CacheStorageModule } from '../cache-storage/cache-storage.module';
import { HostRateLimiterService } from './host-rate-limiter.service';

@Module({
  providers: [HostRateLimiterService],
  imports: [CacheStorageModule],
  exports: [HostRateLimiterService],
})
export class HostRateLimiterModule {}
