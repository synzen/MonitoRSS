import { config } from "dotenv";
import { initPool, closePool, runMigrations } from "../src/stores/postgres";
import { logger } from "../src/shared/utils";

config();

const POSTGRES_URI = process.env.USER_FEEDS_POSTGRES_URI;

async function main() {
  if (!POSTGRES_URI) {
    throw new Error("USER_FEEDS_POSTGRES_URI is required");
  }

  const pool = initPool(POSTGRES_URI);
  logger.info("Connected to PostgreSQL, running migrations...");

  await runMigrations(pool);

  await closePool();
  logger.info("Migrations complete");
}

main().catch((err) => {
  logger.error("Migration failed", { error: (err as Error).stack });
  process.exit(1);
});
