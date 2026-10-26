import { createClient, type RedisClientType } from 'redis';
import { loadConfig } from '../../config';

// Must match the redis-server --databases setting in docker-compose.test.yml.
// DB 0 is reserved for the claim coordinator itself.
const REDIS_DB_COUNT = 64;

/**
 * Claims a dedicated Redis database index for the current test file, so
 * parallel test files never share Redis state. The counter lives on db 0 and
 * resets with the container (tmpfs, recreated per run).
 */
export async function claimTestRedisClient(): Promise<RedisClientType> {
  const uri = loadConfig().FEED_REQUESTS_REDIS_URI;

  const coordinator = createClient({ url: uri, database: 0 });

  await coordinator.connect();

  let db: number;

  try {
    const n = Number(await coordinator.incr('__test_db_counter__'));

    if (n > REDIS_DB_COUNT - 1) {
      throw new Error(
        `Exhausted Redis test DBs: claimed #${n} but only ${REDIS_DB_COUNT - 1} are available ` +
          `(DB 0 is reserved for the coordinator). Raise the --databases setting in ` +
          `docker-compose.test.yml's redis-server command to fit more parallel test files.`,
      );
    }

    db = n;
  } finally {
    await coordinator.disconnect();
  }

  const client = createClient({ url: uri, database: db });

  await client.connect();

  return client;
}
