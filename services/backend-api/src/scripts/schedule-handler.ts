import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

import { ScheduleHandlerService } from '../features/schedule-handler/schedule-handler.service';

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  const scheduleHandlerService = app.get(ScheduleHandlerService);
  // application logic...
  await app.init();

  await scheduleHandlerService.pollForScheduleEvents(
    async ({ refreshRateSeconds }) => {
      const urls = await scheduleHandlerService.getUrlsMatchingRefreshRate(
        refreshRateSeconds,
      );
      console.log(urls);
    },
  );
}
