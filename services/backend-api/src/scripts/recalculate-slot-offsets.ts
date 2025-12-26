/**
 * Script to recalculate slotOffsetMs for ALL feeds.
 *
 * Use this when the slot offset calculation logic has changed and all
 * feeds need their slots recalculated for proper distribution.
 *
 * Usage: npx ts-node src/scripts/recalculate-slot-offsets.ts
 */

import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import { AppModule } from "../app.module";
import { UserFeed, UserFeedModel } from "../features/user-feeds/entities";
import { calculateSlotOffsetMs } from "../common/utils/fnv1a-hash";
import logger from "../utils/logger";

const BATCH_SIZE = 1000;

async function main() {
  logger.info("Starting slotOffsetMs recalculation for all feeds...");

  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  const userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));

  let processed = 0;
  let updated = 0;

  const totalCount = await userFeedModel.countDocuments().exec();
  logger.info(`Total feeds to process: ${totalCount}`);

  const cursor = userFeedModel
    .find({})
    .select("_id url refreshRateSeconds userRefreshRateSeconds")
    .lean()
    .cursor();

  let batch: Array<{
    _id: unknown;
    url: string;
    effectiveRefreshRate: number;
  }> = [];

  for await (const doc of cursor) {
    const effectiveRefreshRate =
      doc.userRefreshRateSeconds ?? doc.refreshRateSeconds;

    if (!effectiveRefreshRate || !doc.url) {
      processed++;
      continue;
    }

    batch.push({
      _id: doc._id,
      url: doc.url,
      effectiveRefreshRate,
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(userFeedModel, batch);
      updated += batch.length;
      processed += batch.length;
      batch = [];

      const percent = ((processed / totalCount) * 100).toFixed(1);
      logger.info(
        `Progress: ${processed}/${totalCount} (${percent}%) - Updated: ${updated}`
      );
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    await processBatch(userFeedModel, batch);
    updated += batch.length;
    processed += batch.length;
  }

  logger.info(
    `Recalculation complete. Processed: ${processed}, Updated: ${updated}`
  );
  await app.close();
  process.exit(0);
}

async function processBatch(
  model: UserFeedModel,
  batch: Array<{ _id: unknown; url: string; effectiveRefreshRate: number }>
) {
  const bulkOps = batch.map(({ _id, url, effectiveRefreshRate }) => ({
    updateOne: {
      filter: { _id },
      update: {
        $set: {
          slotOffsetMs: calculateSlotOffsetMs(url, effectiveRefreshRate),
        },
      },
    },
  }));

  await model.bulkWrite(bulkOps);
}

main().catch((err) => {
  logger.error("Recalculation failed:", { stack: err.stack });
  process.exit(1);
});
