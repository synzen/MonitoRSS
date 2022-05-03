import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScheduleEmitterService } from '../features/schedule-emitter/schedule-emitter.service';
import { ScheduleHandlerService } from '../features/schedule-handler/schedule-handler.service';
import logger from '../utils/logger';

bootstrap();

async function bootstrap() {
  try {
    logger.info('Starting schedule emitter service...');
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();

    setInterval(() => {
      runTimerSync(app);
    }, 1000 * 60);

    await runTimerSync(app);

    logger.info('Initiailized schedule emitter service');
  } catch (err) {
    logger.error(`Failed to initialize schedule emitter`, {
      stack: err.stack,
    });
  }
}

async function runTimerSync(app: INestApplicationContext) {
  const scheduleEmitterService = app.get(ScheduleEmitterService);
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.info(`Syncing timer states`);
    await scheduleEmitterService.syncTimerStates(async (refreshRateSeconds) => {
      try {
        logger.info(`Handling refresh rate ${refreshRateSeconds}s`);
        await scheduleHandlerService.handleRefreshRate(refreshRateSeconds, {
          urlHandler: async (url) => console.log(url),
          feedHandler: async (feed) => console.log(feed),
        });
      } catch (err) {
        logger.error(`Failed to handle schedule event`, {
          stack: err.stack,
        });
      }
    });
  } catch (err) {
    logger.error(`Failed to sync timer states`, {
      stack: err.stack,
    });
  }
}
