import { MikroORM } from "@mikro-orm/core";
import logger from "../utils/logger";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { INestApplicationContext } from "@nestjs/common";

dayjs.extend(utc);

async function pruneAndCreatePartitions(app: INestApplicationContext) {
  const orm = app.get(MikroORM);
  const connection = orm.em.getConnection();
  const startOfMonth = dayjs().utc().startOf("month");
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, "month");
  const nextNextMonthDate = startOfMonth.add(2, "month");

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
      tableName: `delivery_record_partitioned_y${thisMonthDate.year()}m${
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
      tableName: `delivery_record_partitioned_y${nextMonthDate.year()}m${
        nextMonthDate.month() + 1
      }`,
      partitionParent: "delivery_record_partitioned",
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
            ` TO ('${to.toISOString()}');`
        );
      })
    );

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
