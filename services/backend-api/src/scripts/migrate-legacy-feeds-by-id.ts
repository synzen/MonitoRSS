import "../infra/dayjs-locales";
import { Command } from "commander";
import mongoose from "mongoose";
import { loadConfig } from "../config";
import { createMongoConnection, closeMongoConnection } from "../infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "../infra/rabbitmq";
import { createContainer } from "../container";
import { LegacyFeedConversionService } from "../services/legacy-feed-conversion/legacy-feed-conversion.service";
import { FeedMongooseRepository } from "../repositories/mongoose/feed.mongoose.repository";
import { FeedSubscriberMongooseRepository } from "../repositories/mongoose/feed-subscriber.mongoose.repository";
import { FeedFilteredFormatMongooseRepository } from "../repositories/mongoose/feed-filtered-format.mongoose.repository";
import { FailRecordMongooseRepository } from "../repositories/mongoose/fail-record.mongoose.repository";
import { DiscordServerProfileMongooseRepository } from "../repositories/mongoose/discord-server-profile.mongoose.repository";
import logger from "../infra/logger";
import type { IFeed } from "../repositories/interfaces/feed.types";

const program = new Command();

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

interface MigrationResult {
  feedId: string;
  guildId: string;
  channelId: string;
  title: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

interface MigrationSummary {
  totalFeeds: number;
  processed: number;
  successful: number;
  skipped: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  failedFeeds: MigrationResult[];
  skippedFeeds: MigrationResult[];
}

program
  .requiredOption("--user <id>", "Discord user ID to own all converted feeds")
  .requiredOption(
    "--feed <ids>",
    "Comma-separated legacy feed IDs (Mongo ObjectIds) to migrate",
  )
  .requiredOption(
    "--target-channel <id>",
    "Discord channel ID the converted feeds should deliver to",
  )
  .requiredOption("--legacy-uri <uri>", "MongoDB URI of the legacy database")
  .option("--dry-run", "Preview without database changes", false);

program.parse(process.argv);

const options = program.opts() as {
  user: string;
  feed: string;
  targetChannel: string;
  legacyUri: string;
  dryRun: boolean;
};

async function processFeed(
  feed: IFeed,
  conversionService: LegacyFeedConversionService,
  discordUserId: string,
  targetChannelId: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    feedId: feed.id,
    guildId: feed.guild,
    channelId: targetChannelId,
    title: feed.title,
    success: false,
  };

  try {
    if (dryRun) {
      await conversionService.convertToUserFeed(feed, {
        discordUserId,
        doNotSave: true,
        targetChannelId,
      });
      logger.info(`[DRY-RUN] Would convert feed ${feed.id}`, {
        title: feed.title,
        fromChannel: feed.channel,
        toChannel: targetChannelId,
      });
      result.success = true;
    } else {
      // The legacy DB is never written to; feeds there stay unchanged.
      await conversionService.convertToUserFeed(feed, {
        discordUserId,
        markConverted: false,
        targetChannelId,
      });
      logger.info(`Converted feed ${feed.id}`, {
        title: feed.title,
        toChannel: targetChannelId,
      });
      result.success = true;
    }
  } catch (err) {
    const error = err as Error;
    result.error = error.message;
    logger.error(`Failed to convert feed ${feed.id}`, {
      error: error.message,
      title: feed.title,
      guild: feed.guild,
    });
  }

  return result;
}

function printSummary(summary: MigrationSummary, dryRun: boolean) {
  const durationMs = summary.endTime
    ? summary.endTime.getTime() - summary.startTime.getTime()
    : 0;
  const durationSec = (durationMs / 1000).toFixed(2);

  logger.info("\n" + "=".repeat(60));
  logger.info("MIGRATION SUMMARY (BY FEED ID)");
  logger.info("=".repeat(60));
  logger.info(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  logger.info(`Duration: ${durationSec} seconds`);
  logger.info("");
  logger.info(`Total Legacy Feeds:  ${summary.totalFeeds}`);
  logger.info(`Processed:           ${summary.processed}`);
  logger.info(`Successful:          ${summary.successful}`);
  logger.info(`Skipped (dup URL):   ${summary.skipped}`);
  logger.info(`Failed:              ${summary.failed}`);
  logger.info("");

  if (summary.skippedFeeds.length > 0) {
    logger.info("SKIPPED FEEDS (URL already owned by user):");
    logger.info("-".repeat(60));
    summary.skippedFeeds.slice(0, 50).forEach((feed) => {
      logger.info(`  Feed ID: ${feed.feedId}`);
      logger.info(`    Title: ${feed.title}`);
      logger.info("");
    });

    if (summary.skippedFeeds.length > 50) {
      logger.info(
        `  ... and ${summary.skippedFeeds.length - 50} more skipped feeds`,
      );
    }
  }

  if (summary.failedFeeds.length > 0) {
    logger.info("FAILED FEEDS:");
    logger.info("-".repeat(60));
    summary.failedFeeds.slice(0, 50).forEach((feed) => {
      logger.info(`  Feed ID: ${feed.feedId}`);
      logger.info(`    Guild: ${feed.guildId}`);
      logger.info(`    Title: ${feed.title}`);
      logger.info(`    Error: ${feed.error}`);
      logger.info("");
    });

    if (summary.failedFeeds.length > 50) {
      logger.info(
        `  ... and ${summary.failedFeeds.length - 50} more failed feeds`,
      );
    }
  }

  logger.info("=".repeat(60) + "\n");
}

async function main() {
  const summary: MigrationSummary = {
    totalFeeds: 0,
    processed: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    startTime: new Date(),
    failedFeeds: [],
    skippedFeeds: [],
  };

  const config = loadConfig();

  const feedIds = options.feed
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const invalidIds = feedIds.filter((id) => !OBJECT_ID_PATTERN.test(id));

  if (feedIds.length === 0 || invalidIds.length > 0) {
    logger.error("Invalid legacy feed IDs via --feed", {
      invalidIds: invalidIds.length > 0 ? invalidIds : feedIds,
    });
    process.exit(1);
  }

  logger.info("Starting legacy feed migration by feed ID...", {
    user: options.user,
    feeds: feedIds,
    targetChannel: options.targetChannel,
    dryRun: options.dryRun,
  });

  const mongoConnection = await createMongoConnection(
    config.BACKEND_API_MONGODB_URI,
  );
  const rabbitmq = await createRabbitConnection(
    config.BACKEND_API_RABBITMQ_BROKER_URL,
  );

  const container = createContainer({
    config,
    mongoConnection,
    rabbitmq,
  });

  const legacyConnection = mongoose.createConnection(options.legacyUri, {
    autoIndex: false,
  });
  await legacyConnection.asPromise();

  const teardown = async () => {
    await legacyConnection.close();
    await closeRabbitConnection(rabbitmq);
    await closeMongoConnection(mongoConnection);
  };

  try {
    logger.info("Application context initialized");

    const legacyFeedRepository = new FeedMongooseRepository(legacyConnection);
    const legacySubscriberRepository = new FeedSubscriberMongooseRepository(
      legacyConnection,
    );
    const legacyFilteredFormatRepository =
      new FeedFilteredFormatMongooseRepository(legacyConnection);
    const legacyFailRecordRepository = new FailRecordMongooseRepository(
      legacyConnection,
    );
    const legacyProfileRepository =
      new DiscordServerProfileMongooseRepository(legacyConnection);

    const conversionService = new LegacyFeedConversionService({
      feedRepository: legacyFeedRepository,
      feedSubscriberRepository: legacySubscriberRepository,
      feedFilteredFormatRepository: legacyFilteredFormatRepository,
      failRecordRepository: legacyFailRecordRepository,
      discordServerProfileRepository: legacyProfileRepository,
      userFeedRepository: container.userFeedRepository,
      userFeedLimitOverrideRepository:
        container.userFeedLimitOverrideRepository,
      supportersService: container.supportersService,
      discordApiService: container.discordApiService,
    });

    const found = await Promise.all(
      feedIds.map((feedId) => legacyFeedRepository.findById(feedId)),
    );
    const feeds = found.filter((feed): feed is IFeed => feed !== null);

    const foundIds = new Set(feeds.map((feed) => feed.id));
    const missingIds = feedIds.filter((id) => !foundIds.has(id));

    for (const missingId of missingIds) {
      summary.failed++;
      summary.failedFeeds.push({
        feedId: missingId,
        guildId: "",
        channelId: options.targetChannel,
        title: "",
        success: false,
        error: "Not found in the legacy database",
      });
    }

    if (missingIds.length > 0) {
      logger.error(
        `Found ${feeds.length}/${feedIds.length} feeds in the legacy database`,
        { missingIds },
      );
    } else {
      logger.info(`Found all ${feeds.length} feeds in the legacy database`);
    }

    summary.totalFeeds = feeds.length;

    if (feeds.length === 0) {
      logger.info("No feeds to migrate");
      summary.endTime = new Date();
      printSummary(summary, options.dryRun);
      await teardown();
      process.exit(summary.failed > 0 ? 1 : 0);
    }

    const existingByUrl = options.dryRun
      ? []
      : await container.userFeedRepository.findByUrls(
          options.user,
          feeds.map((feed) => feed.url),
        );
    const existingUrlSet = new Set(existingByUrl.map((f) => f.url));

    for (const feed of feeds) {
      if (!options.dryRun && existingUrlSet.has(feed.url)) {
        logger.info(
          `Skipping feed ${feed.id}: URL already exists as a user feed`,
        );
        summary.processed++;
        summary.skipped++;
        summary.skippedFeeds.push({
          feedId: feed.id,
          guildId: feed.guild,
          channelId: options.targetChannel,
          title: feed.title,
          success: false,
          skipped: true,
        });
        continue;
      }

      const result = await processFeed(
        feed,
        conversionService,
        options.user,
        options.targetChannel,
        options.dryRun,
      );

      summary.processed++;

      if (result.success) {
        summary.successful++;
      } else {
        summary.failed++;
        summary.failedFeeds.push(result);
      }
    }

    summary.endTime = new Date();
    printSummary(summary, options.dryRun);

    await teardown();
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error("Migration failed", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    summary.endTime = new Date();
    printSummary(summary, options.dryRun);
    await teardown();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  logger.error("Unhandled error in migration script", {
    stack: (err as Error).stack,
  });
  process.exit(1);
});
