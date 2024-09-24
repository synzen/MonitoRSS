import { MikroORM } from '@mikro-orm/core';
import logger from '../utils/logger';
import dayjs from 'dayjs';
import { INestApplicationContext } from '@nestjs/common';

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const twoMonthsAgoDate = dayjs().subtract(2, 'month');
  const nextMonthDate = dayjs().add(1, 'month');
  const nextNextMonthDate = dayjs().add(2, 'month');

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

  const tableNameToCreate = `request_partitioned_y${nextMonthDate.year()}m${
    nextMonthDate.month() + 1
  }`;

  try {
    const result = await connection.execute(
      `CREATE TABLE IF NOT EXISTS` +
        ` ${tableNameToCreate}` +
        ` PARTITION OF request_partitioned` +
        ` FOR VALUES FROM ('${nextMonthDate.toISOString()}')` +
        ` TO ('${nextNextMonthDate.toISOString()}');`,
    );

    logger.debug(`Partition table "${tableNameToCreate}" created`, {
      result,
    });
  } catch (err) {
    logger.error('Failed to create table partitions', {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
