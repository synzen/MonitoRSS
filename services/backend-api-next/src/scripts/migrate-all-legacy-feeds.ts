import "../infra/dayjs-locales";
import { Command } from "commander";
import { loadConfig } from "../config";
import { createMongoConnection, closeMongoConnection } from "../infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "../infra/rabbitmq";
import { createContainer } from "../container";
import { ConversionDisabledCode } from "../services/legacy-feed-conversion/legacy-feed-conversion.service";
import logger from "../infra/logger";
import type { IFeed } from "../repositories/interfaces/feed.types";

const program = new Command();

interface MigrationResult {
  feedId: string;
  guildId: string;
  url: string;
  title: string;
  success: boolean;
  error?: string;
}

interface MigrationSummary {
  totalFeeds: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  failedFeeds: MigrationResult[];
}

program
  .requiredOption("--user <id>", "Discord user ID to own all converted feeds")
  .requiredOption(
    "--guild <ids>",
    'Comma-separated guild IDs, or "*" for all guilds',
  )
  .option("--dry-run", "Preview without database changes", false);

program.parse(process.argv);

const options = program.opts() as {
  user: string;
  guild: string;
  dryRun: boolean;
};

async function processFeed(
  feed: IFeed,
  container: ReturnType<typeof createContainer>,
  discordUserId: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    feedId: feed.id,
    guildId: feed.guild,
    url: feed.url,
    title: feed.title,
    success: false,
  };

  try {
    if (dryRun) {
      await container.legacyFeedConversionService.convertToUserFeed(feed, {
        discordUserId,
        doNotSave: true,
      });
      logger.info(`[DRY-RUN] Would convert feed ${feed.id}`, {
        title: feed.title,
        url: feed.url,
        guild: feed.guild,
      });
      result.success = true;
    } else {
      await container.legacyFeedConversionService.convertToUserFeed(feed, {
        discordUserId,
      });
      logger.info(`Converted feed ${feed.id}`, {
        title: feed.title,
        url: feed.url,
      });
      result.success = true;
    }
  } catch (err) {
    const error = err as Error;
    result.error = error.message;
    logger.error(`Failed to convert feed ${feed.id}`, {
      error: error.message,
      title: feed.title,
      url: feed.url,
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
  logger.info("MIGRATION SUMMARY");
  logger.info("=".repeat(60));
  logger.info(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  logger.info(`Duration: ${durationSec} seconds`);
  logger.info("");
  logger.info(`Total Legacy Feeds:  ${summary.totalFeeds}`);
  logger.info(`Processed:           ${summary.processed}`);
  logger.info(`Successful:          ${summary.successful}`);
  logger.info(`Failed:              ${summary.failed}`);
  logger.info("");

  if (summary.failedFeeds.length > 0) {
    logger.info("FAILED FEEDS:");
    logger.info("-".repeat(60));
    summary.failedFeeds.slice(0, 50).forEach((feed) => {
      logger.info(`  Feed ID: ${feed.feedId}`);
      logger.info(`    Guild: ${feed.guildId}`);
      logger.info(`    Title: ${feed.title}`);
      logger.info(`    URL: ${feed.url}`);
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
    failed: 0,
    startTime: new Date(),
    failedFeeds: [],
  };

  const config = loadConfig();

  logger.info("Starting legacy feed migration script...", {
    user: options.user,
    guild: options.guild,
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

  try {
    logger.info("Application context initialized");

    const guildIds: string[] | "*" =
      options.guild === "*"
        ? "*"
        : options.guild.split(",").map((id: string) => id.trim());

    const feeds = await container.feedRepository.findUnconvertedByGuilds({
      guildIds,
      conversionDisabledCodes: Object.values(ConversionDisabledCode),
    });
    summary.totalFeeds = feeds.length;

    logger.info(`Found ${feeds.length} unconverted legacy feeds`);

    if (feeds.length === 0) {
      logger.info("No feeds to migrate");
      printSummary(summary, options.dryRun);
      await closeRabbitConnection(rabbitmq);
      await closeMongoConnection(mongoConnection);
      process.exit(0);
    }

    for (const feed of feeds) {
      const result = await processFeed(
        feed,
        container,
        options.user,
        options.dryRun,
      );

      summary.processed++;

      if (result.success) {
        summary.successful++;
      } else {
        summary.failed++;
        summary.failedFeeds.push(result);
      }

      if (summary.processed % 100 === 0) {
        const progressPercent = (
          (summary.processed / summary.totalFeeds) *
          100
        ).toFixed(1);
        logger.info(
          `Progress: ${progressPercent}% (${summary.processed}/${summary.totalFeeds})`,
        );
      }
    }

    summary.endTime = new Date();
    printSummary(summary, options.dryRun);

    await closeRabbitConnection(rabbitmq);
    await closeMongoConnection(mongoConnection);
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error("Migration failed", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    summary.endTime = new Date();
    printSummary(summary, options.dryRun);
    await closeRabbitConnection(rabbitmq);
    await closeMongoConnection(mongoConnection);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Unhandled error in migration script", {
    stack: (err as Error).stack,
  });
  process.exit(1);
});
