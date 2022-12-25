import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import logger from "./shared/utils/logger";

export async function setupFeedListener() {
  await NestFactory.createApplicationContext(
    AppModule.forFeedListenerService()
  );

  logger.info("Feed handler service initialized");
}
