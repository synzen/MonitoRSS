import { loadConfig } from "./config";
import { createMessageBroker } from "./message-broker";
import { createDiscordClient } from "./discord-client";
import logger from "./logger";

async function main() {
  logger.info("Starting app...");

  const config = loadConfig();
  const broker = createMessageBroker(config.rabbitMqUrl);
  const discord = await createDiscordClient(config, broker);

  logger.info("Running");

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}, shutting down...`);

    discord.destroy();
    await broker.close();

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
