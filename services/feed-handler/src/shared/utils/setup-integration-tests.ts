import { EntityName, MikroOrmModule } from "@mikro-orm/nestjs";
import { ModuleMetadata } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { config } from "../../config";
import { MikroORM } from "@mikro-orm/core";
import { randomUUID } from "crypto";
import { SqlEntityManager } from "@mikro-orm/postgresql";

let testingModule: TestingModule;
let orm: MikroORM;
const postgresSchema = randomUUID().replaceAll("-", "");

interface Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models?: EntityName<Partial<any>>[];
}

export async function setupIntegrationTests(
  metadata: ModuleMetadata,
  options?: Options
) {
  const configVals = config();

  const { Test } = await import("@nestjs/testing");

  const uncompiledModule = Test.createTestingModule({
    ...metadata,
    imports: [
      ...(metadata.imports || []),
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [config],
        isGlobal: true,
      }),
      MikroOrmModule.forFeature(options?.models || []),
      MikroOrmModule.forRoot({
        entities: ["dist/**/*.entity.js"],
        entitiesTs: ["src/**/*.entity.ts"],
        clientUrl: configVals.FEED_HANDLER_POSTGRES_URI,
        dbName: configVals.FEED_HANDLER_POSTGRES_DATABASE,
        type: "postgresql",
        forceUtcTimezone: true,
        timezone: "UTC",
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

export async function teardownIntegrationTests() {
  if (orm) {
    const generator = orm.getSchemaGenerator();
    await generator.dropSchema();
    // const typedEm = orm.em as SqlEntityManager;
    await orm.em.transactional(async (em) => {
      await (em as SqlEntityManager).execute(
        `DROP SCHEMA IF EXISTS "${postgresSchema}" CASCADE`
      );
    });

    await orm.close();
  }

  await testingModule?.close();
}
