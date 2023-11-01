import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { ScheduleEmitterService } from "../features/schedule-emitter/schedule-emitter.service";
import { ScheduleHandlerService } from "../features/schedule-handler/schedule-handler.service";
import logger from "../utils/logger";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting schedule emitter service...");
    const app = await NestFactory.createApplicationContext(
      AppModule.forScheduleEmitter()
    );
    await app.init();

    setInterval(() => {
      runTimerSync(app);
    }, 1000 * 60);

    await runTimerSync(app);

    logger.info("Initiailized schedule emitter service");
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
    logger.debug(`Syncing timer states`);
    await scheduleEmitterService.syncTimerStates(async (refreshRateSeconds) => {
      try {
        logger.debug(`Handling refresh rate ${refreshRateSeconds}s`);

        await scheduleHandlerService.handleRefreshRate(refreshRateSeconds, {
          urlsHandler: async (data) =>
            urlsEventHandler(app, {
              data,
              rateSeconds: refreshRateSeconds,
            }),
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

async function urlsEventHandler(
  app: INestApplicationContext,
  data: {
    rateSeconds: number;
    data: Array<{ url: string }>;
  }
) {
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.debug(`Handling urls event for refresh rate ${data.rateSeconds}`, {
      data,
    });
    await scheduleHandlerService.emitUrlRequestBatchEvent(data);
  } catch (err) {
    logger.error(`Failed to handle url event`, {
      stack: err.stack,
    });
  }
}
