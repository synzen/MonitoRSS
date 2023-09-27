import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import logger from "../utils/logger";
import {
  LegacyFeedConversionJob,
  LegacyFeedConversionJobModel,
} from "../features/legacy-feed-conversion/entities/legacy-feed-conversion-job.entity";
import { getModelToken } from "@nestjs/mongoose";
import { LegacyFeedConversionStatus } from "../features/legacy-feed-conversion/constants/legacy-feed-conversion-status.constants";
import dayjs from "dayjs";
import { LegacyFeedConversionService } from "../features/legacy-feed-conversion/legacy-feed-conversion.service";
import { Feed, FeedModel } from "../features/feeds/entities/feed.entity";
import { DiscordAPIError } from "../common/errors/DiscordAPIError";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting legacy feed bulk converter service...");
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();
    logger.info("Initiailized legacy feed bulk converter service");

    const legacyFeedConversionJobModel = app.get<LegacyFeedConversionJobModel>(
      getModelToken(LegacyFeedConversionJob.name)
    );
    const feedModel = app.get<FeedModel>(getModelToken(Feed.name));
    const conversionService = app.get(LegacyFeedConversionService);

    setInterval(async () => {
      try {
        await processLegacyFeedBulkConversionJobs({
          legacyFeedConversionJobModel,
          conversionService,
          feedModel,
        });
      } catch (err) {
        logger.error(`Failed to process jobs`, {
          stack: err.stack,
        });
      }
    }, 1000 * 5);
  } catch (err) {
    logger.error(`Failed to initialize schedule emitter`, {
      stack: err.stack,
    });
  }
}

export async function processLegacyFeedBulkConversionJobs({
  conversionService,
  feedModel,
  legacyFeedConversionJobModel,
}: {
  legacyFeedConversionJobModel: LegacyFeedConversionJobModel;
  feedModel: FeedModel;
  conversionService: LegacyFeedConversionService;
}) {
  const oldestInProgress = await legacyFeedConversionJobModel
    .findOne({
      status: LegacyFeedConversionStatus.InProgress,
    })
    .sort({
      createdAt: 1,
    })
    .limit(1)
    .lean();

  if (oldestInProgress) {
    if (dayjs().diff(oldestInProgress.createdAt, "minute") < 3) {
      return;
    }

    // If older than 3 minutes, update again
    await legacyFeedConversionJobModel.updateOne(
      {
        _id: oldestInProgress._id,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.Failed,
          failReasonPublic: `Took too long to process`,
        },
      }
    );
  }

  const jobToHandle = await legacyFeedConversionJobModel
    .findOneAndUpdate(
      {
        status: LegacyFeedConversionStatus.NotStarted,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.InProgress,
        },
      }
    )
    .sort({
      createdAt: 1,
    })
    .lean();

  if (!jobToHandle) {
    return;
  }

  const { discordUserId, legacyFeedId } = jobToHandle;

  const legacyFeed = await feedModel.findById(legacyFeedId).lean();

  if (!legacyFeed) {
    await legacyFeedConversionJobModel.updateOne(
      {
        _id: jobToHandle._id,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.Failed,
          failReasonPublic: `Feed does not exist`,
        },
      }
    );

    return;
  }

  try {
    await conversionService.convertToUserFeed(legacyFeed, {
      discordUserId,
      isBulkConversion: true,
    });

    await legacyFeedConversionJobModel.updateOne(
      {
        _id: jobToHandle._id,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.Completed,
        },
      }
    );
  } catch (err) {
    let publicReason = `Internal error`;

    if (
      err instanceof DiscordAPIError &&
      (err.statusCode === 403 || err.statusCode === 401)
    ) {
      if (legacyFeed.webhook) {
        publicReason = `Bot is missing permissions. Ensure the bot has Manage Webhooks permission.`;
      } else {
        publicReason = `Bot is missing permissions. Ensure the bot has permissions to view the channel.`;
      }
    }

    await legacyFeedConversionJobModel.updateOne(
      {
        _id: jobToHandle._id,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.Failed,
          failReasonPublic: publicReason,
          failReasonInternal: err.message,
        },
      }
    );
  }
}
