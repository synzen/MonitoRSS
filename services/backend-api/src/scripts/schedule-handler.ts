import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

import { ScheduleHandlerService } from '../features/schedule-handler/schedule-handler.service';
import logger from '../utils/logger';

bootstrap();

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    const scheduleHandlerService = app.get(ScheduleHandlerService);
    await app.init();

    await scheduleHandlerService.pollForScheduleEvents(
      async ({ refreshRateSeconds }) => {
        const urls = await scheduleHandlerService.getUrlsMatchingRefreshRate(
          refreshRateSeconds,
        );
        console.log(urls);
      },
    );
  } catch (err) {
    logger.error(`Failed to initialize schedule handler`, {
      stack: err.stack,
    });
  }
}
