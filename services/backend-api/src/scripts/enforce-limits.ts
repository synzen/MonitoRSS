import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { ScheduleHandlerService } from "../features/schedule-handler/schedule-handler.service";
import logger from "../utils/logger";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Enforcing limits");
    const app = await NestFactory.createApplicationContext(
      AppModule.forScheduleEmitter()
    );
    await app.init();

    const scheduleHandlerService = app.get(ScheduleHandlerService);

    await scheduleHandlerService.enforceUserFeedLimits();

    logger.info("Completed");
  } catch (err) {
    logger.error(`Error`, {
      stack: err.stack,
    });
  }
}
