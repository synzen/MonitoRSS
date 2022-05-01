import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScheduleEmitterService } from '../features/schedule-emitter/schedule-emitter.service';
import logger from '../utils/logger';

bootstrap();

async function bootstrap() {
  try {
    logger.info('Starting schedule emitter service...');
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();

    setInterval(() => {
      runTimerSync(app)
    }, 1000 * 60);

    await runTimerSync(app)

    logger.info('Initiailized schedule emitter service');
  } catch (err) {
    logger.error(`Failed to initialize schedule emitter`, {
      stack: err.stack,
    });
  }
}

async function runTimerSync(app: INestApplicationContext) {
  const scheduleEmitterService = app.get(ScheduleEmitterService);

  try {
    logger.info(`Syncing timer states`);
    await scheduleEmitterService.syncTimerStates(
      async (refreshRateSeconds) => {
        try {
          await scheduleEmitterService.emitScheduleEvent({
            refreshRateSeconds,
          });
          logger.info(`Refreshed at ${refreshRateSeconds}s`);
      } catch (err) {
        logger.error(`Failed to emit schedule event`, {
          stack: err.stack,
        });
      }
      },
    );
  } catch (err) {
    logger.error(`Failed to sync timer states`, {
      stack: err.stack,
    });
  }
}
