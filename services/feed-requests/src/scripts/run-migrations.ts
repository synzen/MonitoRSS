import dotenv from 'dotenv';
import path from 'path';
import { Client, Pool } from 'pg';
import logger from '../utils/logger';
import {
  runMigrationsUp,
  runMigrationsDown,
} from '../stores/postgres/migrations';

// The migration container may receive a partial environment (the compose
// migration service doesn't pass every runtime variable), so the database URI
// is read directly rather than through the full validated config.
const envFiles: Record<string, string> = {
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
};

dotenv.config({
  path: path.join(
    __dirname,
    '..',
    '..',
    '..',
    envFiles[process.env.NODE_ENV as string] || envFiles.local,
  ),
});

function parseDbNameFromUri(uri: string): { baseUri: string; dbName: string } {
  const url = new URL(uri);
  const dbName = url.pathname.slice(1);
  url.pathname = '/postgres';

  return { baseUri: url.toString(), dbName };
}

async function ensureDatabaseExists(uri: string): Promise<void> {
  const { baseUri, dbName } = parseDbNameFromUri(uri);

  const client = new Client({ connectionString: baseUri });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
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
  const uri = process.env.FEED_REQUESTS_POSTGRES_URI;

  if (!uri) {
    throw new Error('FEED_REQUESTS_POSTGRES_URI is required');
  }

  const direction = process.argv[2] === 'down' ? 'down' : 'up';

  await ensureDatabaseExists(uri);

  const pool = new Pool({ connectionString: uri });

  try {
    if (direction === 'down') {
      await runMigrationsDown(pool);
    } else {
      const executed = await runMigrationsUp(pool);

      if (executed.length === 0) {
        logger.info('No pending migrations');
      } else {
        logger.info(`Applied ${executed.length} migration(s)`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error('Migration run failed', { error: (err as Error).stack });
  process.exit(1);
});
