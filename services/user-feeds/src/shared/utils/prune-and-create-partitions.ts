import { MikroORM } from "@mikro-orm/core";
import logger from "../utils/logger";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    ORDER BY child ASC;`
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
  const configService = app.get(ConfigService);
  const connection = orm.em.getConnection();
  const startOfMonth = dayjs().utc().startOf("month");
  const thisMonthDate = startOfMonth;
  const nextMonthDate = startOfMonth.add(1, "month");
  const nextNextMonthDate = startOfMonth.add(2, "month");

  const tableNamesToCreate = [
    `feed_article_field_partitioned_y${thisMonthDate.year()}m${
      thisMonthDate.month() + 1
    }`,
    `delivery_record_partitioned_y${thisMonthDate.year()}m${
      thisMonthDate.month() + 1
    }`,
    `feed_article_field_partitioned_y${nextMonthDate.year()}m${
      nextMonthDate.month() + 1
    }`,
    `delivery_record_partitioned_y${nextMonthDate.year()}m${
      nextMonthDate.month() + 1
    }`,
  ];

  const tablesToCreate = [
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: tableNamesToCreate[0],
      partitionParent: "feed_article_field_partitioned",
    },
    {
      from: thisMonthDate,
      to: nextMonthDate,
      tableName: tableNamesToCreate[1],
      partitionParent: "delivery_record_partitioned",
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: tableNamesToCreate[2],
      partitionParent: "feed_article_field_partitioned",
    },
    {
      from: nextMonthDate,
      to: nextNextMonthDate,
      tableName: tableNamesToCreate[3],
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

  // Prune old partitions
  try {
    const currentPartitions = await getCurrentPartitions(
      "feed_article_field_partitioned",
      orm
    );

    const numberOfPartitionsToKeep = configService.getOrThrow<number>(
      "USER_FEEDS_ARTICLE_PERSISTENCE_MONTHS"
    );

    const numberOfPartitionsToDrop =
      currentPartitions.length - numberOfPartitionsToKeep;

    const tablesToDrop = currentPartitions
      .slice(0, numberOfPartitionsToDrop)
      .filter((partition) => !tableNamesToCreate.includes(partition.child));

    if (tablesToDrop.length) {
      logger.info(
        `Will eventually dorp partitions for feed_article_field_partitioned`,
        {
          partitions: tablesToDrop.map((partition) => partition.child),
        }
      );

      // await Promise.all(
      //   tablesToDrop.map(async (partition) => {
      //     await connection.execute(
      //       `DROP TABLE IF EXISTS ${partition.childSchema}.${partition.child};`
      //     );
      //   })
      // );
    }
  } catch (err) {
    logger.error(
      "Failed to prune old partitions for feed_article_field_partitioned",
      {
        error: (err as Error).stack,
      }
    );
  }

  try {
    const currentDeliveryPartitions = await getCurrentPartitions(
      "delivery_record_partitioned",
      orm
    );

    if (currentDeliveryPartitions.length > 1) {
      const numberOfDeliveryPartitionsToKeep = configService.getOrThrow<number>(
        "USER_FEEDS_DELIVERY_RECORD_PERSISTENCE_MONTHS"
      );
      const numberOfDeliveryPartitionsToDrop =
        currentDeliveryPartitions.length - numberOfDeliveryPartitionsToKeep;

      const deliveryTablesToDrop = currentDeliveryPartitions.slice(
        0,
        numberOfDeliveryPartitionsToDrop
      );

      logger.info(
        `Will eventually drop partitions for delivery_record_partitioned`,
        {
          partitions: deliveryTablesToDrop.map((partition) => partition.child),
        }
      );

      // if (deliveryTablesToDrop.length) {
      //   logger.info(`Dropping partitions for delivery_record_partitioned`, {
      //     partitions: deliveryTablesToDrop.map((partition) => partition.child),
      //   });

      //   await Promise.all(
      //     deliveryTablesToDrop.map(async (partition) => {
      //       await connection.execute(
      //         `DROP TABLE IF EXISTS ${partition.childSchema}.${partition.child};`
      //       );
      //     })
      //   );
      // }
    }
  } catch (err) {
    logger.error(
      "Failed to prune old partitions for delivery_record_partitioned",
      {
        error: (err as Error).stack,
      }
    );
  }
}

export default pruneAndCreatePartitions;
