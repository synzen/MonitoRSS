import { INestApplicationContext } from "@nestjs/common";
import "source-map-support/register";
import { setupFeedListener } from "./setup-feed-listener";
import { setupHttpApi } from "./setup-http-api";
import logger from "./shared/utils/logger";
import pruneAndCreatePartitions from "./shared/utils/prune-and-create-partitions";

async function bootstrap() {
  try {
    if (process.env.USER_FEEDS_START_TARGET === "service") {
      const { app } = await setupFeedListener();
      await schedulePruneAndCreatePartitions(app);
    } else if (process.env.USER_FEEDS_START_TARGET === "api") {
      const { app } = await setupHttpApi();
      await schedulePruneAndCreatePartitions(app);
    } else {
      const { app } = await setupHttpApi();
      await schedulePruneAndCreatePartitions(app);
      await setupFeedListener();
    }
  } catch (err) {
    logger.error(`Failed to start service`, {
      error: (err as Error).stack,
    });
  }
}

async function schedulePruneAndCreatePartitions(app: INestApplicationContext) {
  await pruneAndCreatePartitions(app);

  setInterval(() => {
    logger.info("Running recurring task to prune and create partitions...");
    pruneAndCreatePartitions(app)
      .then(() => {
        logger.info(
          "Recurring task to prune and create partitions ran successfully"
        );
      })
      .catch(() => {
        logger.error(
          `Failed to run recurring task to prune and create partitions`
        );
        process.exit(1);
      });
  }, 60000 * 24);
}

bootstrap();
