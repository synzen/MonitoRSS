import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScheduleEmitterService } from '../features/schedule-emitter/schedule-emitter.service';
import logger from '../utils/logger';

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  // application logic...
  await app.init();

  const schedulEmitterService = app.get(ScheduleEmitterService);

  setInterval(async () => {
    try {
      logger.info(`Syncing timer states`);
      await schedulEmitterService.syncTimerStates(
        async (refreshRateSeconds) => {
          logger.info(`Refreshing at ${refreshRateSeconds}s`);
          await schedulEmitterService.emitScheduleEvent({
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
