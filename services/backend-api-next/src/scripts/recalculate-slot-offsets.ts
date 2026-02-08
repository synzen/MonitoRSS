import "../infra/dayjs-locales";
import { loadConfig } from "../config";
import { createMongoConnection, closeMongoConnection } from "../infra/mongoose";
import { createContainer } from "../container";
import { calculateSlotOffsetMs } from "../shared/utils/fnv1a-hash";
import logger from "../infra/logger";

const BATCH_SIZE = 1000;

async function main() {
  const config = loadConfig();

  logger.info("Starting slotOffsetMs recalculation for all feeds...");

  const mongoConnection = await createMongoConnection(
    config.BACKEND_API_MONGODB_URI,
  );

  const container = createContainer({
    config,
    mongoConnection,
    rabbitmq: null as never,
  });

  try {
    const totalCount = await container.userFeedRepository.countAllFeeds();
    logger.info(`Total feeds to process: ${totalCount}`);

    let processed = 0;
    let updated = 0;
    let batch: Array<{ feedId: string; slotOffsetMs: number }> = [];

    for await (const feed of container.userFeedRepository.iterateAllFeedsForSlotRecalculation()) {
      const effectiveRefreshRate =
        feed.userRefreshRateSeconds ?? feed.refreshRateSeconds;

      if (!effectiveRefreshRate || !feed.url) {
        processed++;
        continue;
      }

      batch.push({
        feedId: feed.id,
        slotOffsetMs: calculateSlotOffsetMs(feed.url, effectiveRefreshRate),
      });

      if (batch.length >= BATCH_SIZE) {
        await container.userFeedRepository.bulkUpdateSlotOffsets(batch);
        updated += batch.length;
        processed += batch.length;
        batch = [];

        const percent = ((processed / totalCount) * 100).toFixed(1);
        logger.info(
          `Progress: ${processed}/${totalCount} (${percent}%) - Updated: ${updated}`,
        );
      }
    }

    if (batch.length > 0) {
      await container.userFeedRepository.bulkUpdateSlotOffsets(batch);
      updated += batch.length;
      processed += batch.length;
    }

    logger.info(
      `Recalculation complete. Processed: ${processed}, Updated: ${updated}`,
    );
  } finally {
    await closeMongoConnection(mongoConnection);
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error("Recalculation failed", { stack: (err as Error).stack });
  process.exit(1);
});
