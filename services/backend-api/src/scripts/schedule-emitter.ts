import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Feed } from '../features/feeds/entities/feed.entity';
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
          urlHandler: async (url) =>
            urlEventHandler(app, {
              url,
              rateSeconds: refreshRateSeconds,
            }),
          feedHandler: async (feed) => feedEventHandler(app, { feed }),
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

async function urlEventHandler(
  app: INestApplicationContext,
  data: {
    url: string;
    rateSeconds: number;
  },
) {
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.debug(`Handling url event`, {
      data,
    });
    await scheduleHandlerService.emitUrlRequestEvent(data);
  } catch (err) {
    logger.error(`Failed to handle url event`, {
      stack: err.stack,
    });
  }
}

async function feedEventHandler(
  app: INestApplicationContext,
  data: {
    feed: Feed;
  },
) {
  try {
    logger.debug(`Handling feed event`, {
      data,
    });
  } catch (err) {
    logger.error(`Failed to handle feed event`, {
      stack: err.stack,
    });
  }
}
