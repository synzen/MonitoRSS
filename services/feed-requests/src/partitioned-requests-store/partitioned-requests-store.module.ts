import { Module } from '@nestjs/common';
import PartitionedRequestsStoreService from './partitioned-requests-store.service';

@Module({
  providers: [PartitionedRequestsStoreService],
  exports: [PartitionedRequestsStoreService],
})
export class PartitionedRequestsStoreModule {}
