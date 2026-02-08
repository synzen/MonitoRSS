import "./src/infra/dayjs-locales";
import { loadConfig } from "./src/config";
import {
  createMongoConnection,
  closeMongoConnection,
} from "./src/infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "./src/infra/rabbitmq";
import { createContainer, type Container } from "./src/container";
import { SCHEDULER_WINDOW_SIZE_MS } from "./src/shared/constants/scheduler.constants";
import { decrypt } from "./src/shared/utils/decrypt";
import { RedditAppRevokedException } from "./src/shared/exceptions/reddit.exceptions";
import logger from "./src/infra/logger";

const REDDIT_REFRESH_INTERVAL_MS = 1000 * 60 * 20; // 20 minutes
const MAINTENANCE_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes
const REDDIT_CREDENTIAL_EXPIRY_WINDOW_MS = 1000 * 60 * 60 * 2; // 2 hours

let timersIntervalId: ReturnType<typeof setInterval> | null = null;
let maintenanceIntervalId: ReturnType<typeof setInterval> | null = null;
let redditRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

async function main() {
  const config = loadConfig();

  logger.info("Starting schedule emitter service...");

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

  logger.info("Applying migrations...");
  container.mongoMigrationsService
    .applyMigrations()
    .then(() => {
      logger.info("Migrations applied");
    })
    .catch((err) => {
      logger.error("Failed to apply migrations", {
        error: (err as Error).stack,
      });
    });

  refreshRedditCredentials(container);
  redditRefreshIntervalId = setInterval(() => {
    refreshRedditCredentials(container);
  }, REDDIT_REFRESH_INTERVAL_MS);

  runMaintenanceOps(container);
  maintenanceIntervalId = setInterval(() => {
    runMaintenanceOps(container);
  }, MAINTENANCE_INTERVAL_MS);

  await runTimers(container);
  timersIntervalId = setInterval(() => {
    runTimers(container).catch((err) => {
      logger.error("Failed to run timers", { error: (err as Error).stack });
    });
  }, SCHEDULER_WINDOW_SIZE_MS);

  logger.info("Schedule emitter service initialized");

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);

    if (timersIntervalId) clearInterval(timersIntervalId);
    if (maintenanceIntervalId) clearInterval(maintenanceIntervalId);
    if (redditRefreshIntervalId) clearInterval(redditRefreshIntervalId);
    logger.info("Cleared all intervals");

    try {
      await closeRabbitConnection(rabbitmq);
    } catch (err) {
      logger.error("Error closing RabbitMQ connection", {
        error: (err as Error).stack,
      });
    }

    try {
      await closeMongoConnection(mongoConnection);
    } catch (err) {
      logger.error("Error closing MongoDB connection", {
        error: (err as Error).stack,
      });
    }

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

async function runTimers(container: Container) {
  const { refreshRateSeconds, userRefreshRateSeconds } =
    await container.userFeedRepository.getDistinctRefreshRates();

  const currentRefreshRatesMs = new Set(
    [...refreshRateSeconds, ...userRefreshRateSeconds]
      .filter((s) => !!s)
      .map((seconds) => seconds * 1000),
  );

  const promises = Array.from(currentRefreshRatesMs).map(
    async (refreshRateMs) => {
      try {
        await container.scheduleHandlerService.handleRefreshRate(
          refreshRateMs / 1000,
          {
            urlsHandler: async (data) =>
              container.scheduleHandlerService.emitUrlRequestBatchEvent({
                rateSeconds: refreshRateMs / 1000,
                data,
              }),
          },
        );
      } catch (err) {
        logger.error(
          `Failed to trigger refresh rate ${refreshRateMs / 1000}s`,
          {
            stack: (err as Error).stack,
          },
        );
      }
    },
  );

  await Promise.all(promises);
}

async function runMaintenanceOps(container: Container) {
  try {
    await container.scheduleHandlerService.runMaintenanceOperations();
  } catch (err) {
    logger.error("Failed to run maintenance operations", {
      error: (err as Error).stack,
    });
  }
}

async function refreshRedditCredentials(container: Container) {
  try {
    const encryptionKey = container.config.BACKEND_API_ENCRYPTION_KEY_HEX;

    if (!encryptionKey) {
      logger.debug(
        "Encryption key not found, skipping credentials refresh task",
      );
      return;
    }

    logger.debug("Refreshing credentials on schedule");

    const usersIterator =
      container.userRepository.iterateUsersWithExpiringRedditCredentials(
        REDDIT_CREDENTIAL_EXPIRY_WINDOW_MS,
      );

    for await (const user of usersIterator) {
      logger.debug(`Refreshing reddit credentials for user ${user.userId}`, {
        user,
      });

      try {
        if (!user.encryptedRefreshToken) {
          logger.debug(
            `No reddit credentials found for user ${user.userId}, skipping`,
          );
          continue;
        }

        const {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_in: expiresIn,
        } = await container.redditApiService.refreshAccessToken(
          decrypt(user.encryptedRefreshToken, encryptionKey),
        );

        await container.usersService.setRedditCredentials({
          userId: user.userId,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        });

        logger.info(
          `Refreshed reddit credentials for user ${user.userId} successfully`,
        );
      } catch (err) {
        if (err instanceof RedditAppRevokedException) {
          logger.debug(
            `Reddit app has been revoked, revoking credentials for user ${user.userId}`,
          );

          await container.usersService.revokeRedditCredentials(
            user.userId,
            user.credentialId,
          );

          continue;
        }

        logger.error(
          `Failed to refresh reddit credentials for user ${user.userId}`,
          { error: (err as Error).stack },
        );
      }
    }
  } catch (err) {
    logger.error("Failed to refresh reddit credentials on schedule", {
      error: (err as Error).stack,
    });
  }
}

main().catch((err) => {
  logger.error("Failed to start schedule emitter service", {
    error: (err as Error).stack,
  });
  process.exit(1);
});
