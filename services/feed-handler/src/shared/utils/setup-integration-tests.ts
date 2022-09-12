import { EntityName, MikroOrmModule } from "@mikro-orm/nestjs";
import { ModuleMetadata } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { config } from "../../config";
import { MikroORM } from "@mikro-orm/core";

let testingModule: TestingModule;
let orm: MikroORM;

interface Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models?: EntityName<Partial<any>>[];
}

export async function setupIntegrationTests(
  metadata: ModuleMetadata,
  options?: Options
) {
  const configVals = config();
  const postgresSchema = "feedservice_int_tests";

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
        autoLoadEntities: true,
        clientUrl: configVals.POSTGRES_URI,
        dbName: configVals.POSTGRES_DATABASE,
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
  await generator?.refreshDatabase();
}

export async function teardownIntegrationTests() {
  if (orm) {
    const generator = orm.getSchemaGenerator();
    await generator.dropSchema();
  }

  await testingModule?.close();
}
