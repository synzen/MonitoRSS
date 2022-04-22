import { Module } from '@nestjs/common';
import { SqsPollingService } from '../../common/services/sqs-polling.service';
import { FeedsModule } from '../feeds/feeds.module';
import { FailedUrlHandlerService } from './failed-url-handler.service';

@Module({
  providers: [FailedUrlHandlerService, SqsPollingService],
  imports: [FeedsModule],
})
export class FailedUrlHandlerModule {}
