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
import { createContainer } from "./src/container";
import { createApp, startApp } from "./src/app";
import logger from "./src/infra/logger";

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
