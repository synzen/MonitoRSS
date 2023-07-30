import "../utils/dd-tracer";
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
import { INestApplicationContext } from "@nestjs/common";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting legacy feed bulk converter service...");
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();
    logger.info("Initiailized legacy feed bulk converter service");

    setInterval(async () => {
      try {
        await processLegacyFeedBulkConversionJobs(app);
      } catch (err) {
        logger.error(`Failed to process jobs`, {
          stack: err.stack,
        });
      }
    }, 1000 * 5);
    await processLegacyFeedBulkConversionJobs(app);
  } catch (err) {
    logger.error(`Failed to initialize schedule emitter`, {
      stack: err.stack,
    });
  }
}

export async function processLegacyFeedBulkConversionJobs(
  app: INestApplicationContext
) {
  const legacyFeedConversionJobModel = app.get<LegacyFeedConversionJobModel>(
    getModelToken(LegacyFeedConversionJob.name)
  );
  const feedModel = app.get<FeedModel>(getModelToken(Feed.name));

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

  const convertService = app.get(LegacyFeedConversionService);

  try {
    await convertService.convertToUserFeed(legacyFeed, {
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
    await legacyFeedConversionJobModel.updateOne(
      {
        _id: jobToHandle._id,
      },
      {
        $set: {
          status: LegacyFeedConversionStatus.Failed,
          failReasonPublic: `Internal error`,
          failReasonInternal: err.message,
        },
      }
    );
  }
}
