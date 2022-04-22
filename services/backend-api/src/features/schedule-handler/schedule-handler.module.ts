import { Module } from '@nestjs/common';
import { SqsPollingService } from '../../common/services/sqs-polling.service';
import { FeedsModule } from '../feeds/feeds.module';
import { SupportersModule } from '../supporters/supporters.module';
import { ScheduleHandlerService } from './schedule-handler.service';

@Module({
  providers: [ScheduleHandlerService, SqsPollingService],
  imports: [SupportersModule, FeedsModule],
})
export class ScheduleHandlerModule {}
