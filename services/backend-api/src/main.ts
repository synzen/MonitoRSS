import "./infra/dayjs-locales";
import { loadConfig, Environment } from "./config";
import { createMongoConnection, closeMongoConnection } from "./infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "./infra/rabbitmq";
import { createContainer } from "./container";
import { createApp, startApp } from "./app";
import logger from "./infra/logger";

async function main() {
  const config = loadConfig();

  logger.info("Starting backend-api-next...");

  // Initialize infrastructure
  const mongoConnection = await createMongoConnection(
    config.BACKEND_API_MONGODB_URI,
  );
  const rabbitmq = await createRabbitConnection(
    config.BACKEND_API_RABBITMQ_BROKER_URL,
  );

  // Create container with dependencies
  const container = createContainer({
    config,
    mongoConnection,
    rabbitmq,
  });

  // Seed curated feeds in non-production environments
  if (config.NODE_ENV !== Environment.Production) {
    const existingFeeds = await container.curatedFeedRepository.getAll();
    if (existingFeeds.length === 0) {
      const { default: mockData } =
        await import("./features/curated-feeds/data/curated-feeds-mock.json");
      const session = await mongoConnection.startSession();
      try {
        await session.withTransaction(async () => {
          await container.curatedCategoryRepository.replaceAll(
            mockData.categories.map((c: { id: string; label: string }) => ({
              categoryId: c.id,
              label: c.label,
            })),
            session,
          );
          await container.curatedFeedRepository.replaceAll(
            mockData.feeds,
            session,
          );
        });
        logger.info(
          `Seeded curated feeds from mock data (${mockData.feeds.length} feeds, ${mockData.categories.length} categories)`,
        );
      } finally {
        await session.endSession();
      }
    }
  }

  // Initialize message broker consumers
  await container.messageBrokerEventsService.initialize();

  // Create and start the Fastify app
  const app = await createApp(container);
  await startApp(app, config.BACKEND_API_PORT);

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);

    try {
      await app.close();
      logger.info("HTTP server stopped");
    } catch (err) {
      logger.error("Error stopping HTTP server", {
        error: (err as Error).stack,
      });
    }

    try {
      await container.messageBrokerEventsService.close();
    } catch (err) {
      logger.error("Error closing message broker consumers", {
        error: (err as Error).stack,
      });
    }

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

main().catch((err) => {
  logger.error("Failed to start service", { error: (err as Error).stack });
  process.exit(1);
});
