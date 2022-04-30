import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScheduleEmitterService } from '../features/schedule-emitter/schedule-emitter.service';
import logger from '../utils/logger';

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  await app.init();

  const scheduleEmitterService = app.get(ScheduleEmitterService);

  setInterval(async () => {
    try {
      logger.info(`Syncing timer states`);
      await scheduleEmitterService.syncTimerStates(
        async (refreshRateSeconds) => {
          logger.info(`Refreshing at ${refreshRateSeconds}s`);
          await scheduleEmitterService.emitScheduleEvent({
            refreshRateSeconds,
          });
        },
      );
    } catch (err) {
      logger.error(`Failed to sync timer states`, {
        stack: err.stack,
      });
    }
  }, 1000 * 60);
}
