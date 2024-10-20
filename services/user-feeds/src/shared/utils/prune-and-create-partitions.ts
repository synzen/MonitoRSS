import { MikroORM } from "@mikro-orm/core";
import logger from "../utils/logger";
import dayjs from "dayjs";
import { INestApplicationContext } from "@nestjs/common";

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const sixMonthsAgoDate = dayjs().subtract(6, "month");
  const thisMonthDate = dayjs();
  const nextMonthDate = dayjs().add(1, "month");
  const nextNextMonthDate = dayjs().add(2, "month");

  try {
    const tableNameToDrop = `feed_article_field_partitioned_y${sixMonthsAgoDate.year()}m${
      sixMonthsAgoDate.month() + 1
    }`;

    logger.debug(`Old partition ${tableNameToDrop} dropped`);
  } catch (err) {
    logger.error("Failed to drop old partition", {
      error: (err as Error).stack,
    });
  }

  const tablesToCreate = [
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: `feed_article_field_partitioned_y${thisMonthDate.year()}m${
        thisMonthDate.month() + 1
      }`,
      partitionParent: "feed_article_field_partitioned",
    },
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: `delivery_records_partitioned_y${thisMonthDate.year()}m${
        thisMonthDate.month() + 1
      }`,
      partitionParent: "delivery_record_partitioned",
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: `feed_article_field_partitioned_y${nextMonthDate.year()}m${
        nextMonthDate.month() + 1
      }`,
      partitionParent: "feed_article_field_partitioned",
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: `delivery_records_partitioned_y${nextMonthDate.year()}m${
        nextMonthDate.month() + 1
      }`,
      partitionParent: "delivery_record_partitioned",
    },
  ];

  try {
    tablesToCreate.map(async ({ from, to, tableName, partitionParent }) => {
      await connection.execute(
        `CREATE TABLE IF NOT EXISTS` +
          ` ${tableName}` +
          ` PARTITION OF ${partitionParent}` +
          ` FOR VALUES FROM ('${from.toISOString()}')` +
          ` TO ('${to.toISOString()}');`
      );
    });

    logger.debug(
      `Partition tables ${tablesToCreate
        .map(({ tableName }) => tableName)
        .join(", ")} created`
    );
  } catch (err) {
    logger.error("Failed to create table partitions", {
      error: (err as Error).stack,
    });
  }
}

export default pruneAndCreatePartitions;
