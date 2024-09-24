import { getApplicationContext } from '.';
import logger from '../utils/logger';
import pruneAndCreatePartitions from '../utils/prune-and-create-partitions';

main();

async function main() {
  try {
    logger.info('Running task to prune and create partitions');
    const { app } = await getApplicationContext();
    await app.init();
    await pruneAndCreatePartitions(app);
    process.exit(0);
  } catch (err) {
    logger.error('Failed to run task to prune and create partitions', {
      error: (err as Error).stack,
    });
  }
}
