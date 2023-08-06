import "../utils/dd-tracer";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { ScheduleEmitterService } from "../features/schedule-emitter/schedule-emitter.service";
import { ScheduleHandlerService } from "../features/schedule-handler/schedule-handler.service";
import logger from "../utils/logger";
import { UserFeed } from "../features/user-feeds/entities";

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

        // await scheduleHandlerService.enforceUserFeedLimits();
        await scheduleHandlerService.handleRefreshRate(refreshRateSeconds, {
          urlsHandler: async (data) =>
            urlsEventHandler(app, {
              data,
              rateSeconds: refreshRateSeconds,
            }),
          feedHandler: async (feed, { maxDailyArticles }) =>
            feedEventHandler(app, { feed, maxDailyArticles }),
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
    logger.debug(`Handling urls event`, {
      data,
    });
    await scheduleHandlerService.emitUrlRequestBatchEvent(data);
  } catch (err) {
    logger.error(`Failed to handle url event`, {
      stack: err.stack,
    });
  }
}

async function feedEventHandler(
  app: INestApplicationContext,
  data: {
    feed: UserFeed;
    maxDailyArticles: number;
  }
) {
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.debug(`Handling feed event`, {
      data,
    });
    await scheduleHandlerService.emitDeliverFeedArticlesEvent({
      userFeed: data.feed,
      maxDailyArticles: data.maxDailyArticles,
    });
  } catch (err) {
    logger.error(`Failed to handle feed event`, {
      stack: err.stack,
    });
  }
}
