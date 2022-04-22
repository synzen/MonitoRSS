import { Module } from '@nestjs/common';
import { FeedsModule } from '../feeds/feeds.module';
import { SupportersModule } from '../supporters/supporters.module';
import { ScheduleEmitterService } from './schedule-emitter.service';

@Module({
  providers: [ScheduleEmitterService],
  imports: [FeedsModule, SupportersModule],
})
export class ScheduleEmitterModule {}
