import { MikroORM } from "@mikro-orm/core";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import logger from "./shared/utils/logger";

export async function setupFeedListener() {
  const app = await NestFactory.createApplicationContext(
    AppModule.forFeedListenerService()
  );

  app.enableShutdownHooks();

  const orm = app.get(MikroORM);

  setInterval(() => {
    tryDbConnection(orm).catch(() => process.exit(1));
  }, 60000);

  logger.info("Feed handler service initialized");
}

async function tryDbConnection(orm: MikroORM, currentTries = 0) {
  if (currentTries >= 10) {
    logger.error("Failed to connect to database after 10 tries. Exiting...");

    process.exit(1);
  }

  await orm.em
    .getDriver()
    .getConnection()
    .execute("SELECT 1")
    .catch((err) => {
      logger.error("Failed to ping database", {
        error: (err as Error).stack,
      });

      return tryDbConnection(orm, currentTries + 1);
    });
}
