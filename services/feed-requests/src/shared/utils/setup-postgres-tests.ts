import 'reflect-metadata';
import { EntityName, MikroOrmModule } from '@mikro-orm/nestjs';
import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { MikroORM } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import config from '../../config';
import { testConfig } from '../../config/test.config';

let testingModule: TestingModule;
let orm: MikroORM;
const postgresSchema = randomUUID().replace(/-/g, '');

interface Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models?: EntityName<Partial<any>>[];
}

export async function setupPostgresTests(
  metadata: ModuleMetadata,
  options?: Options,
) {
  const configVals = config();

  const { Test } = await import('@nestjs/testing');

  const uncompiledModule = Test.createTestingModule({
    ...metadata,
    imports: [
      ...(metadata.imports || []),
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [testConfig],
        isGlobal: true,
      }),
      MikroOrmModule.forFeature(options?.models || []),
      MikroOrmModule.forRoot({
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        clientUrl: configVals.FEED_REQUESTS_POSTGRES_URI,
        type: 'postgresql',
        forceUtcTimezone: true,
        timezone: 'UTC',
        schema: postgresSchema,
        allowGlobalContext: true,
      }),
    ],
  });

  const init = async () => {
    testingModule = await uncompiledModule.compile();
    orm = testingModule.get(MikroORM);
    const generator = orm.getSchemaGenerator();
    await generator.ensureDatabase();
    await generator.dropSchema();
    await generator.createSchema();

    return {
      module: testingModule,
    };
  };

  return {
    uncompiledModule,
    init,
  };
}

export async function clearDatabase() {
  const generator = orm?.getSchemaGenerator();
  await generator.ensureDatabase();
  await generator.dropSchema();
  await generator.createSchema();
}

export async function teardownPostgresTests() {
  if (orm) {
    const generator = orm.getSchemaGenerator();
    await generator.dropSchema();
    // const typedEm = orm.em as SqlEntityManager;
    await orm.em.transactional(async (em) => {
      await (em as SqlEntityManager).execute(
        `DROP SCHEMA IF EXISTS "${postgresSchema}" CASCADE`,
      );
    });

    await orm.close();
  }

  await testingModule?.close();
}
