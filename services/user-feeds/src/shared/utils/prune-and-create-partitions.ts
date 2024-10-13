import { MikroORM } from "@mikro-orm/core";
import logger from "../utils/logger";
import dayjs from "dayjs";
import { INestApplicationContext } from "@nestjs/common";

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const sixMonthsAgoDate = dayjs().subtract(6, "month");
  const nextMonthDate = dayjs().add(1, "month");
  const nextNextMonthDate = dayjs().add(2, "month");

  try {
    const tableNameToDrop = `feed_article_field_partitioned_y${sixMonthsAgoDate.year()}m${
      sixMonthsAgoDate.month() + 1
    }`;

    const dropResult = await connection.execute(
      `DROP TABLE IF EXISTS ${tableNameToDrop};`
    );

    logger.debug(`Old partition ${tableNameToDrop} dropped`, {
      dropResult,
    });
  } catch (err) {
    logger.error("Failed to drop old partition", {
      error: (err as Error).stack,
    });
  }

  const tableNameToCreate = `feed_article_field_partitioned_y${nextMonthDate.year()}m${
    nextMonthDate.month() + 1
  }`;

  try {
    const result = await connection.execute(
      `CREATE TABLE IF NOT EXISTS` +
        ` ${tableNameToCreate}` +
        ` PARTITION OF feed_article_field_partitioned` +
        ` FOR VALUES FROM ('${nextMonthDate.toISOString()}')` +
        ` TO ('${nextNextMonthDate.toISOString()}');`
    );

    logger.debug(`Partition table "${tableNameToCreate}" created`, {
      result,
    });
  } catch (err) {
    logger.error("Failed to create table partitions", {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
