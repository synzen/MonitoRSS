import { NestFactory } from "@nestjs/core";
import { program } from "commander";
import { getModelToken } from "@nestjs/mongoose";
import { AppModule } from "../app.module";
import logger from "../utils/logger";
import { Feed, FeedModel } from "../features/feeds/entities/feed.entity";
import {
  ConversionDisabledCode,
  LegacyFeedConversionService,
} from "../features/legacy-feed-conversion/legacy-feed-conversion.service";

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
    'Comma-separated guild IDs, or "*" for all guilds'
  )
  .option("--dry-run", "Preview without database changes", false);

program.parse();

const options = program.opts<{
  user: string;
  guild: string;
  dryRun: boolean;
}>();

bootstrap();

async function bootstrap() {
  const summary: MigrationSummary = {
    totalFeeds: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
    failedFeeds: [],
  };

  try {
    logger.info("Starting legacy feed migration script...", {
      user: options.user,
      guild: options.guild,
      dryRun: options.dryRun,
    });

    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();

    const feedModel = app.get<FeedModel>(getModelToken(Feed.name));
    const conversionService = app.get(LegacyFeedConversionService);

    logger.info("Application context initialized");

    const feeds = await getUnconvertedFeeds(feedModel, options.guild);
    summary.totalFeeds = feeds.length;

    logger.info(`Found ${feeds.length} unconverted legacy feeds`);

    if (feeds.length === 0) {
      logger.info("No feeds to migrate");
      printSummary(summary, options.dryRun);
      await app.close();
      process.exit(0);
    }

    for (const feed of feeds) {
      const result = await processFeed(
        feed,
        conversionService,
        options.user,
        options.dryRun
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
          `Progress: ${progressPercent}% (${summary.processed}/${summary.totalFeeds})`
        );
      }
    }

    summary.endTime = new Date();
    printSummary(summary, options.dryRun);

    await app.close();
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error("Migration failed", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    summary.endTime = new Date();
    printSummary(summary, options.dryRun);
    process.exit(1);
  }
}

async function getUnconvertedFeeds(
  feedModel: FeedModel,
  guildOption: string
): Promise<Feed[]> {
  const query: Record<string, unknown> = {
    disabled: {
      $nin: Object.values(ConversionDisabledCode),
    },
  };

  if (guildOption !== "*") {
    const guildIds = guildOption.split(",").map((id) => id.trim());
    query.guild = { $in: guildIds };
  }

  return feedModel.find(query).lean();
}

async function processFeed(
  feed: Feed,
  conversionService: LegacyFeedConversionService,
  discordUserId: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = {
    feedId: feed._id.toHexString(),
    guildId: feed.guild,
    url: feed.url,
    title: feed.title,
    success: false,
  };

  try {
    if (dryRun) {
      logger.info(`[DRY-RUN] Would convert feed ${feed._id}`, {
        title: feed.title,
        url: feed.url,
        guild: feed.guild,
      });
      result.success = true;
    } else {
      await conversionService.convertToUserFeed(feed, {
        discordUserId,
      });
      logger.info(`Converted feed ${feed._id}`, {
        title: feed.title,
        url: feed.url,
      });
      result.success = true;
    }
  } catch (err) {
    const error = err as Error;
    result.error = error.message;
    logger.error(`Failed to convert feed ${feed._id}`, {
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
        `  ... and ${summary.failedFeeds.length - 50} more failed feeds`
      );
    }
  }

  logger.info("=".repeat(60) + "\n");
}
