import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createConnection, DataSource, QueryRunner } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface PostgresTestOptions {
  moduleMetadata?: ModuleMetadata;
  databaseName: string;
}

/**
 * Used to instantiate a nest application for the TypeORM module.
 */
export const postgresTestConfig = (
  override?: Partial<PostgresConnectionOptions>,
): PostgresConnectionOptions => {
  return {
    database: 'test',
    username: 'postgres',
    password: '12345',
    type: 'postgres',
    name: 'default',
    logging: true,
    logger: 'debug',
    synchronize: true,
    ...override,
  };
};

export const setupPostgresDatabase = async (databaseName: string) => {
  const ormMaintenanceDatabaseConfig = postgresTestConfig({
    name: 'maintenance',
  });
  const setupConnection = await createConnection(ormMaintenanceDatabaseConfig);
  await setupConnection.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await setupConnection.query(`CREATE DATABASE ${databaseName}`);
  await setupConnection.query(
    `ALTER DATABASE ${databaseName} SET timezone TO 'UTC'`,
  );
  await setupConnection.close();
};

export const teardownPostgresDatabase = async (databaseName: string) => {
  const ormMaintenanceDatabaseConfig = postgresTestConfig({
    name: 'maintenance',
  });
  const teardownConnection = await createConnection(
    ormMaintenanceDatabaseConfig,
  );
  await teardownConnection.query(`DROP DATABASE ${databaseName}`);
  await teardownConnection.close();
};

async function setupPostgresTests({
  databaseName,
  moduleMetadata,
}: PostgresTestOptions) {
  const config = postgresTestConfig({
    database: databaseName,
  });
  let databaseIsSetup = false;

  const uncompiledModule = Test.createTestingModule({
    ...moduleMetadata,
    imports: [
      TypeOrmModule.forRoot({
        ...config,
        autoLoadEntities: true,
      }),
      ...(moduleMetadata?.imports || []),
    ],
  });

  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let module: TestingModule;

  const setupDatabase = async () => {
    await setupPostgresDatabase(databaseName);
    module = await uncompiledModule.compile();
    await module.init();
    const dataSource = module.get(DataSource);
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    databaseIsSetup = true;

    return {
      module,
      queryRunner,
    };
  };

  const resetDatabase = async () => {
    // TODO: synchronize doesn not work.
    // await dataSource?.synchronize(true);
  };

  const teardownDatabase = async () => {
    if (!databaseIsSetup) {
      return;
    }

    await module?.close();
    await teardownPostgresDatabase(databaseName);
  };

  return {
    uncompiledModule,
    setupDatabase,
    resetDatabase,
    teardownDatabase,
  };
}

export default setupPostgresTests;
