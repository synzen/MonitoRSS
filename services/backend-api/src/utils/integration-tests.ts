import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { stopMemoryServer } from './mongoose-test.module';

let testingModule: TestingModule;

export async function setupIntegrationTests(metadata: ModuleMetadata) {
  const uncompiledModule = Test.createTestingModule({
    ...metadata,
    imports: [
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ...metadata.imports,
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
      }),
    ],
  });

  const init = async () => {
    testingModule = await uncompiledModule.compile();

    return {
      module: testingModule,
    };
  };

  return {
    uncompiledModule,
    init,
  };
}

export async function teardownIntegrationTests() {
  await testingModule?.close();
  await stopMemoryServer();
}
