import type { Pool } from 'pg';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import logger from './logger';

dayjs.extend(utc);

async function pruneAndCreatePartitions(
  pool: Pool,
  historyPersistenceMonths: number,
) {
  const startOfMonth = dayjs().utc().startOf('month');
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, 'month');
  const nextNextMonthDate = startOfMonth.add(2, 'month');

  const thisMonthTableName = `request_partitioned_y${thisMonthDate.year()}m${
    thisMonthDate.month() + 1
  }`;

  const nextMonthTableName = `request_partitioned_y${nextMonthDate.year()}m${
    nextMonthDate.month() + 1
  }`;

  const cutoffDate = startOfMonth.subtract(historyPersistenceMonths, 'month');
  const tableNameToDrop = `request_partitioned_y${cutoffDate.year()}m${
    cutoffDate.month() + 1
  }`;

  if (
    tableNameToDrop === thisMonthTableName ||
    tableNameToDrop === nextMonthTableName
  ) {
    logger.debug(`Skipping prune of protected partition ${tableNameToDrop}`);
  } else {
    try {
      const dropResult = await pool.query(
        `DROP TABLE IF EXISTS ${tableNameToDrop};`,
      );

      logger.debug(`Old partition ${tableNameToDrop} dropped`, {
        dropResult: dropResult.rows,
      });
    } catch (err) {
      logger.error('Failed to drop old partition', {
        error: (err as Error).stack,
      });
    }
  }

  const tablesToCreate = [
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: thisMonthTableName,
      partitionParent: 'request_partitioned',
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: nextMonthTableName,
      partitionParent: 'request_partitioned',
    },
  ];

  try {
    await Promise.all(
      tablesToCreate.map(async ({ from, to, tableName, partitionParent }) => {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS` +
            ` ${tableName}` +
            ` PARTITION OF ${partitionParent}` +
            ` FOR VALUES FROM ('${from.toISOString()}')` +
            ` TO ('${to.toISOString()}');`,
        );
      }),
    );

    logger.debug(`Partition table "${nextMonthTableName}" created`);
  } catch (err) {
    logger.error('Failed to create table partitions', {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
