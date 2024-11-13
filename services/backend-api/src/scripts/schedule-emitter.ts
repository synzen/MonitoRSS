import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import applyMongoMigrations from "../apply-mongo-migrations";
import { ScheduleEmitterService } from "../features/schedule-emitter/schedule-emitter.service";
import { ScheduleHandlerService } from "../features/schedule-handler/schedule-handler.service";
import logger from "../utils/logger";
import { getModelToken } from "@nestjs/mongoose";
import { UserFeed, UserFeedModel } from "../features/user-feeds/entities";
import { User, UserModel } from "../features/users/entities/user.entity";
import { UserExternalCredentialType } from "../common/constants/user-external-credential-type.constants";
import { RedditApiService } from "../services/apis/reddit/reddit-api.service";
import { getCommonFeedAggregateStages } from "../common/utils";
import { PipelineStage } from "mongoose";
import { getRedditUrlRegex } from "../utils/get-reddit-url-regex";
import dayjs from "dayjs";
import { ConfigService } from "@nestjs/config";
import decrypt from "../utils/decrypt";
import { UsersService } from "../features/users/users.service";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting schedule emitter service...");
    const app = await NestFactory.createApplicationContext(
      AppModule.forScheduleEmitter()
    );
    await app.init();
    logger.info(`Applying migrations...`);
    applyMongoMigrations(app)
      .then(() => {
        logger.info(`Migrations applied`);
      })
      .catch((err) => {
        logger.error(`Failed to apply migrations`, {
          stack: err.stack,
        });
      });

    setInterval(() => {
      runTimerSync(app);
    }, 1000 * 60);

    refreshRedditCredentials(app);
    setInterval(() => {
      refreshRedditCredentials(app);
    }, 1000 * 60 * 20); // Every 20 minutes

    await runTimerSync(app);

    logger.info("Initiailized schedule emitter service");
  } catch (err) {
    logger.error(`Failed to initialize schedule emitter`, {
      stack: err.stack,
    });
  }
}

async function runTimerSync(app: INestApplicationContext) {
  const scheduleEmitterService = app.get(ScheduleEmitterService);
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.debug(`Syncing timer states`);
    await scheduleEmitterService.syncTimerStates(async (refreshRateSeconds) => {
      try {
        logger.debug(`Handling refresh rate ${refreshRateSeconds}s`);

        await scheduleHandlerService.handleRefreshRate(refreshRateSeconds, {
          urlsHandler: async (data) =>
            urlsEventHandler(app, {
              data,
              rateSeconds: refreshRateSeconds,
            }),
        });
      } catch (err) {
        logger.error(`Failed to handle schedule event`, {
          stack: err.stack,
        });
      }
    });
  } catch (err) {
    logger.error(`Failed to sync timer states`, {
      stack: err.stack,
    });
  }
}

async function urlsEventHandler(
  app: INestApplicationContext,
  data: {
    rateSeconds: number;
    data: Array<{ url: string }>;
  }
) {
  const scheduleHandlerService = app.get(ScheduleHandlerService);

  try {
    logger.debug(`Handling urls event for refresh rate ${data.rateSeconds}`, {
      data,
    });
    await scheduleHandlerService.emitUrlRequestBatchEvent(data);
  } catch (err) {
    logger.error(`Failed to handle url event`, {
      stack: err.stack,
    });
  }
}

async function refreshRedditCredentials(app: INestApplicationContext) {
  try {
    const redditApiService = app.get<RedditApiService>(RedditApiService);
    const configService = app.get(ConfigService);
    const userModel = app.get<UserModel>(getModelToken(User.name));
    const userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));
    const usersService = app.get(UsersService);
    const encryptionKey = configService.get<string>(
      "BACKEND_API_ENCRYPTION_KEY_HEX"
    );

    if (!encryptionKey) {
      return;
    }

    const users = userModel
      .find({
        externalCredentials: {
          $elemMatch: {
            type: UserExternalCredentialType.Reddit,
            "data.accessToken": { $exists: true },
            "data.refreshToken": { $exists: true },
            "data.expireAt": {
              $exists: true,
              $gte: dayjs().subtract(1, "hour").toDate(),
            },
          },
        },
      })
      .select("_id externalCredentials discordUserId")
      .cursor();

    const pipeline: PipelineStage[] = getCommonFeedAggregateStages({});

    for await (const user of users) {
      try {
        const redditCredential = user.externalCredentials?.find(
          (c) => c.type === UserExternalCredentialType.Reddit
        );
        const encryptedRefreshToken = redditCredential?.data
          ?.refreshToken as string;

        if (!redditCredential || !encryptedRefreshToken) {
          continue;
        }

        // Check if they have any active reddit feeds
        const relevantFeeds: PipelineStage[] = [
          {
            $match: {
              "user.discordUserId": user.discordUserId,
              url: getRedditUrlRegex(),
            },
          },
          ...pipeline,
          {
            $count: "count",
          },
        ];

        const [{ count }] = await userFeedModel.aggregate(relevantFeeds);

        if (count === 0) {
          continue;
        }

        const {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_in: expiresIn,
        } = await redditApiService.refreshAccessToken(
          decrypt(encryptedRefreshToken, encryptionKey)
        );

        await usersService.updateExternalCredentials({
          userId: user._id,
          externalCredentialId: redditCredential._id,
          expireAt: dayjs().add(expiresIn, "second").toDate(),
          type: UserExternalCredentialType.Reddit,
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
        });

        logger.info(
          `Refreshed reddit credentials for user ${user._id} successfully`
        );
      } catch (err) {
        logger.error(
          `Failed to refresh reddit credentials for user ${user._id}`,
          {
            stack: err.stack,
          }
        );
      }
    }
  } catch (err) {
    logger.error(`Failed to refresh reddit credentials on schedule`, {
      stack: err.stack,
    });
  }
}
