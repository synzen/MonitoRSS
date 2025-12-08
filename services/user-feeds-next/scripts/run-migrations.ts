import { SQL } from "bun";
import { config } from "dotenv";
import { runMigrations } from "../src/stores/postgres";
import { logger } from "../src/shared/utils";

config();

const POSTGRES_URI = process.env.USER_FEEDS_POSTGRES_URI;

async function main() {
  if (!POSTGRES_URI) {
    throw new Error("USER_FEEDS_POSTGRES_URI is required");
  }

  const sql = new SQL(POSTGRES_URI);
  logger.info("Connected to PostgreSQL, running migrations...");

  await runMigrations(sql);

  await sql.close();
  logger.info("Migrations complete");
}

main().catch((err) => {
  logger.error("Migration failed", { error: (err as Error).stack });
  process.exit(1);
});
