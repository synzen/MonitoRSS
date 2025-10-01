import { MikroORM } from '@mikro-orm/core';
import logger from '../utils/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

dayjs.extend(utc);

const getCurrentPartitions = async (tableName: string, orm: MikroORM) => {
  const connection = orm.em.getConnection();

  const result: Array<{
    parent_schema: string;
    parent: string;
    child_schema: string;
    child: string;
  }> = await connection.execute(
    `SELECT
        nmsp_parent.nspname AS parent_schema,
        parent.relname      AS parent,
        nmsp_child.nspname  AS child_schema,
        child.relname       AS child
    FROM pg_inherits
        JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
        JOIN pg_namespace nmsp_parent   ON nmsp_parent.oid  = parent.relnamespace
        JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace
    WHERE parent.relname='${tableName}'
    ORDER BY child ASC;`,
  );

  return result.map((row) => ({
    parentSchema: row.parent_schema,
    parent: row.parent,
    childSchema: row.child_schema,
    child: row.child,
  }));
};

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const configService = app.get(ConfigService);
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

  const thisMonthTableName = `request_partitioned_y${thisMonthDate.year()}m${
    thisMonthDate.month() + 1
  }`;

  const nextMonthTableName = `request_partitioned_y${nextMonthDate.year()}m${
    nextMonthDate.month() + 1
  }`;

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
        await connection.execute(
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

  try {
    // prune old partitions
    const currentPartitions = await getCurrentPartitions(
      'request_partitioned',
      orm,
    );

    const numberOfPartitionsToKeep = configService.getOrThrow<number>(
      'FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS',
    ); // Keep the last two partitions
    const partitionsToDrop =
      currentPartitions.length - numberOfPartitionsToKeep;
    const tablesToDrop = currentPartitions
      .slice(0, partitionsToDrop)
      .filter(
        (partition) =>
          partition.child !== thisMonthTableName &&
          partition.child !== nextMonthTableName,
      );
    logger.info('Will eventually drop old partitions for request_partitioned', {
      tablesToDrop: tablesToDrop.map((table) => table.child),
    });
    // if (tablesToDrop.length > 0) {
    //   logger.info('Dropping old partitions for request_partitioned', {
    //     tablesToDrop: tablesToDrop.map((table) => table.child),
    //   });

    //   await Promise.all(
    //     tablesToDrop.map(async (table) => {
    //       const tableName = `${table.parentSchema}.${table.child}`;
    //       await connection.execute(`DROP TABLE IF EXISTS ${tableName};`);
    //     }),
    //   );
    // } else {
    //   logger.debug('No old partitions to drop');
    // }
  } catch (err) {
    logger.error('Failed to prune old partitions', {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
