import "source-map-support/register";
import { setupFeedListener } from "./setup-feed-listener";
import { setupHttpApi } from "./setup-http-api";
import logger from "./shared/utils/logger";

async function bootstrap() {
  try {
    if (process.env.USER_FEEDS_START_TARGET === "service") {
      await setupFeedListener();
    } else if (process.env.USER_FEEDS_START_TARGET === "api") {
      await setupHttpApi();
    } else {
      await setupFeedListener();
      await setupHttpApi();
    }
  } catch (err) {
    logger.error(`Failed to start service`, {
      error: (err as Error).stack,
    });
  }
}

bootstrap();
