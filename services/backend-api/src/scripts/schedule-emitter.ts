import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import applyMongoMigrations from "../apply-mongo-migrations";
import { ScheduleEmitterService } from "../features/schedule-emitter/schedule-emitter.service";
import { ScheduleHandlerService } from "../features/schedule-handler/schedule-handler.service";
import logger from "../utils/logger";
import { getModelToken } from "@nestjs/mongoose";
import { User, UserModel } from "../features/users/entities/user.entity";
import { UserExternalCredentialType } from "../common/constants/user-external-credential-type.constants";
import { RedditApiService } from "../services/apis/reddit/reddit-api.service";
import dayjs from "dayjs";
import { ConfigService } from "@nestjs/config";
import decrypt from "../utils/decrypt";
import { UsersService } from "../features/users/users.service";
import { RedditAppRevokedException } from "../services/apis/reddit/errors/reddit-app-revoked.exception";
import { UserExternalCredentialStatus } from "../common/constants/user-external-credential-status.constants";

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
    const usersService = app.get(UsersService);
    const encryptionKey = configService.get<string>(
      "BACKEND_API_ENCRYPTION_KEY_HEX"
    );

    if (!encryptionKey) {
      logger.debug(
        `Encryption key not found, skipping credentials refresh task`
      );

      return;
    }

    logger.debug(`Refreshing credentials on schedule`);

    const users = userModel
      .find({
        externalCredentials: {
          $elemMatch: {
            type: UserExternalCredentialType.Reddit,
            "data.accessToken": { $exists: true },
            "data.refreshToken": { $exists: true },
            status: UserExternalCredentialStatus.Active,
            expireAt: {
              $exists: true,
              $lte: dayjs().add(2, "hour").toDate(),
            },
          },
        },
      })
      .lean()
      .select("_id externalCredentials discordUserId")
      .cursor();

    for await (const user of users) {
      logger.debug(`Refreshing reddit credentials for user ${user._id}`, {
        user,
      });

      const redditCredential = user.externalCredentials?.find(
        (c) => c.type === UserExternalCredentialType.Reddit
      );

      const encryptedRefreshToken = redditCredential?.data
        ?.refreshToken as string;

      try {
        if (!encryptedRefreshToken) {
          logger.debug(
            `No reddit credentials found for user ${user._id}, skipping`,
            {
              encryptedRefreshToken,
            }
          );

          continue;
        }

        const {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_in: expiresIn,
        } = await redditApiService.refreshAccessToken(
          decrypt(encryptedRefreshToken, encryptionKey)
        );

        await usersService.setRedditCredentials({
          userId: user._id,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        });

        logger.info(
          `Refreshed reddit credentials for user ${user._id} successfully`
        );
      } catch (err) {
        if (err instanceof RedditAppRevokedException && redditCredential?._id) {
          logger.debug(
            `Reddit app has been revoked, revoking credentials for user ${user._id}`
          );

          await usersService.revokeRedditCredentials(
            user._id,
            redditCredential?._id
          );

          return;
        }

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
