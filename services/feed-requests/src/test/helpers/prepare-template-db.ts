import { prepareTemplateDatabase } from '../../stores/postgres/setup-postgres-tests';
import logger from '../../utils/logger';

// Runs once per test run (wired into test.sh before the test runner) so every
// test file can clone a database whose schema was built by the real migration
// runner.
async function main() {
  await prepareTemplateDatabase();
  logger.info('Test template database prepared');
}

main().catch((err) => {
  logger.error('Failed to prepare test template database', {
    error: (err as Error).stack,
  });
  process.exit(1);
});
