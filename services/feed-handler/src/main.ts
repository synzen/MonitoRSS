import "source-map-support/register";
import { setupFeedListener } from "./setup-feed-listener";
import { setupHttpApi } from "./setup-http-api";

async function bootstrap() {
  try {
    await setupHttpApi();
    await setupFeedListener();
  } catch (err) {
    console.error(`Failed to start service`, {
      error: (err as Error).stack,
    });
  }
}

bootstrap();
