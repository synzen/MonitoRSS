import "../infra/dayjs-locales";
import { loadConfig } from "../config";
import { createMongoConnection, closeMongoConnection } from "../infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "../infra/rabbitmq";
import { createContainer, type Container } from "../container";
import { SCHEDULER_WINDOW_SIZE_MS } from "../shared/constants/scheduler.constants";
import { decrypt } from "../shared/utils/decrypt";
import { RedditAppRevokedException } from "../shared/exceptions/reddit.exceptions";
import logger from "../infra/logger";

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

  const redditRefreshTargets = [
    createUserRedditRefreshTarget(container),
    createWorkspaceRedditRefreshTarget(container),
  ];
  const refreshAllRedditCredentials = () => {
    for (const target of redditRefreshTargets) {
      refreshRedditCredentialsForTarget(container, target);
    }
  };

  refreshAllRedditCredentials();
  redditRefreshIntervalId = setInterval(
    refreshAllRedditCredentials,
    REDDIT_REFRESH_INTERVAL_MS,
  );

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

// A credential-owning scope (user or workspace) swept by the scheduled reddit
// token refresh. The loop body is identical for both; what differs is how to
// enumerate expiring grants, how to store refreshed tokens, and what cleanup a
// dead grant requires.
interface RedditRefreshTarget {
  ownerLabel: "user" | "workspace";
  iterateExpiring(): AsyncIterable<{
    ownerId: string;
    credentialId: string;
    encryptedRefreshToken: string;
  }>;
  setCredentials(
    ownerId: string,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): Promise<void>;
  // The owner pulled the grant from reddit.com directly: mark it revoked and
  // unset lookup keys so feeds stop fetching with the dead token.
  onRevoked(ownerId: string, credentialId: string): Promise<void>;
}

function createUserRedditRefreshTarget(
  container: Container,
): RedditRefreshTarget {
  return {
    ownerLabel: "user",
    iterateExpiring: async function* () {
      for await (const user of container.userRepository.iterateUsersWithExpiringRedditCredentials(
        REDDIT_CREDENTIAL_EXPIRY_WINDOW_MS,
      )) {
        yield {
          ownerId: user.userId,
          credentialId: user.credentialId,
          encryptedRefreshToken: user.encryptedRefreshToken,
        };
      }
    },
    async setCredentials(userId, tokens) {
      await container.usersService.setRedditCredentials({ userId, ...tokens });
    },
    async onRevoked(userId, credentialId) {
      await container.usersService.revokeRedditCredentials(
        userId,
        credentialId,
      );
      await container.usersService.syncLookupKeys({ userIds: [userId] });
    },
  };
}

function createWorkspaceRedditRefreshTarget(
  container: Container,
): RedditRefreshTarget {
  return {
    ownerLabel: "workspace",
    iterateExpiring: async function* () {
      for await (const workspace of container.workspaceRepository.iterateWorkspacesWithExpiringRedditCredentials(
        REDDIT_CREDENTIAL_EXPIRY_WINDOW_MS,
      )) {
        yield {
          ownerId: workspace.workspaceId,
          credentialId: workspace.credentialId,
          encryptedRefreshToken: workspace.encryptedRefreshToken,
        };
      }
    },
    async setCredentials(workspaceId, tokens) {
      // Refresh preserves attribution; if the connection vanished mid-sweep
      // there is nothing to update.
      const existingCredential =
        await container.workspacesService.getRedditCredentials(workspaceId);

      if (!existingCredential) {
        return;
      }

      await container.workspacesService.setRedditCredentials({
        workspaceId,
        connectedByUserId: existingCredential.connectedByUserId,
        ...tokens,
      });
    },
    async onRevoked(workspaceId, credentialId) {
      await container.workspacesService.revokeRedditCredentials(
        workspaceId,
        credentialId,
      );

      await container.workspacesService.syncWorkspaceLookupKeys({
        workspaceIds: [workspaceId],
      });

      // Tell every member so any of them can reconnect.
      const workspace =
        await container.workspaceRepository.findById(workspaceId);

      if (workspace) {
        await container.workspacesService.notifyRedditConnectionLost(workspace);
      }
    },
  };
}

async function refreshRedditCredentialsForTarget(
  container: Container,
  target: RedditRefreshTarget,
) {
  try {
    const encryptionKey = container.config.BACKEND_API_ENCRYPTION_KEY_HEX;

    if (!encryptionKey) {
      logger.debug(
        `Encryption key not found, skipping ${target.ownerLabel} credentials refresh task`,
      );
      return;
    }

    for await (const {
      ownerId,
      credentialId,
      encryptedRefreshToken,
    } of target.iterateExpiring()) {
      try {
        const {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn,
        } = await container.redditApiService.refreshAccessToken(
          decrypt(encryptedRefreshToken, encryptionKey),
        );

        await target.setCredentials(ownerId, {
          accessToken,
          refreshToken,
          expiresIn,
        });

        logger.info(
          `Refreshed reddit credentials for ${target.ownerLabel} ${ownerId} successfully`,
        );
      } catch (err) {
        if (err instanceof RedditAppRevokedException) {
          logger.info(
            `Reddit app has been revoked, revoking credentials for ${target.ownerLabel} ${ownerId}`,
          );

          await target.onRevoked(ownerId, credentialId);

          continue;
        }

        logger.error(
          `Failed to refresh reddit credentials for ${target.ownerLabel} ${ownerId}`,
          { error: (err as Error).stack },
        );
      }
    }
  } catch (err) {
    logger.error(
      `Failed to refresh ${target.ownerLabel} reddit credentials on schedule`,
      { error: (err as Error).stack },
    );
  }
}

main().catch((err) => {
  logger.error("Failed to start schedule emitter service", {
    error: (err as Error).stack,
  });
  process.exit(1);
});
