import { Module } from '@nestjs/common';
import PartitionedRequestsStoreService from './partitioned-requests-store.service';
import { CacheStorageModule } from '../cache-storage/cache-storage.module';
import { ObjectFileStorageModule } from '../object-file-storage/object-file-storage.module';

@Module({
  providers: [PartitionedRequestsStoreService],
  exports: [PartitionedRequestsStoreService],
  imports: [CacheStorageModule, ObjectFileStorageModule],
})
export class PartitionedRequestsStoreModule {}
