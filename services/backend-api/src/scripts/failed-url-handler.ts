import "../utils/dd-tracer";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { FailedUrlHandlerService } from "../features/failed-url-handler/failed-url-handler.service";
import logger from "../utils/logger";

failedUrlHandler();

async function failedUrlHandler() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  const failedUrlHandlerService = app.get(FailedUrlHandlerService);
  await app.init();

  await failedUrlHandlerService.pollForFailedUrlEvents(async ({ url }) => {
    try {
      logger.info(`Failed Url: ${url}, disabling all feeds with url`);
      await failedUrlHandlerService.disableFeedsWithUrl(url);
    } catch (err) {
      logger.error(`Failed to disable feeds with url: ${url}`, {
        stack: err.stack,
      });
    }
  });
}
