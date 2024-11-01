import { MikroORM } from '@mikro-orm/core';
import logger from '../utils/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { INestApplicationContext } from '@nestjs/common';

dayjs.extend(utc);

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const startOfMonth = dayjs().utc().startOf('month');
  const twoMonthsAgoDate = startOfMonth.subtract(2, 'month');
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, 'month');
  const nextNextMonthDate = startOfMonth.add(2, 'month');

  try {
    const tableNameToDrop = `request_partitioned_y${twoMonthsAgoDate.year()}m${
      twoMonthsAgoDate.month() + 1
    }`;

    const dropResult = await connection.execute(
      `DROP TABLE IF EXISTS ${tableNameToDrop};`,
    );

    logger.debug(`Old partition ${tableNameToDrop} dropped`, {
      dropResult,
    });
  } catch (err) {
    logger.error('Failed to drop old partition', {
      error: (err as Error).stack,
    });
  }

  const tablesToCreate = [
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: `request_partitioned_y${thisMonthDate.year()}m${
        thisMonthDate.month() + 1
      }`,
      partitionParent: 'request_partitioned',
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: `request_partitioned_y${nextMonthDate.year()}m${
        nextMonthDate.month() + 1
      }`,
      partitionParent: 'request_partitioned',
    },
  ];

  const tableNameToCreate = `request_partitioned_y${nextMonthDate.year()}m${
    nextMonthDate.month() + 1
  }`;

  try {
    await Promise.all(
      tablesToCreate.map(async ({ from, to, tableName, partitionParent }) => {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS` +
            ` ${tableName}` +
            ` PARTITION OF ${partitionParent}` +
            ` FOR VALUES FROM ('${from.toISOString()}')` +
            ` TO ('${to.toISOString()}');`,
        );
      }),
    );

    logger.debug(`Partition table "${tableNameToCreate}" created`);
  } catch (err) {
    logger.error('Failed to create table partitions', {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
