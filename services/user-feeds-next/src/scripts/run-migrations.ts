import { config } from "dotenv";
import { Client } from "pg";
import { initPool, closePool, runMigrations } from "../stores/postgres";
import { logger } from "../shared/utils";

config();

const POSTGRES_URI = process.env.USER_FEEDS_POSTGRES_URI;

function parseDbNameFromUri(uri: string): { baseUri: string; dbName: string } {
  const url = new URL(uri);
  const dbName = url.pathname.slice(1);
  url.pathname = "/postgres";
  return { baseUri: url.toString(), dbName };
}

async function ensureDatabaseExists(uri: string): Promise<void> {
  const { baseUri, dbName } = parseDbNameFromUri(uri);

  const client = new Client({ connectionString: baseUri });

  try {
    await client.connect();

    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rows.length === 0) {
      logger.info(`Database "${dbName}" does not exist, creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      logger.info(`Database "${dbName}" created`);
    }
  } catch (err) {
    logger.error(`Failed to ensure database "${dbName}" exists`, {
      error: (err as Error).stack,
    });
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  if (!POSTGRES_URI) {
    throw new Error("USER_FEEDS_POSTGRES_URI is required");
  }

  await ensureDatabaseExists(POSTGRES_URI);

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
