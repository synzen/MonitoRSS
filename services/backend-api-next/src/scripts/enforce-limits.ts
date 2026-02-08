import "../infra/dayjs-locales";
import { loadConfig } from "../config";
import { createMongoConnection, closeMongoConnection } from "../infra/mongoose";
import {
  createRabbitConnection,
  closeRabbitConnection,
} from "../infra/rabbitmq";
import { createContainer } from "../container";
import logger from "../infra/logger";

async function main() {
  const config = loadConfig();

  logger.info("Enforcing limits...");

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
    await container.scheduleHandlerService.enforceUserFeedLimits();
    logger.info("Completed");
  } finally {
    await closeRabbitConnection(rabbitmq);
    await closeMongoConnection(mongoConnection);
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error("Failed to enforce limits", {
    stack: (err as Error).stack,
  });
  process.exit(1);
});
