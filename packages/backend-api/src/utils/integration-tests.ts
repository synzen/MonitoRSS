import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { stopMemoryServer } from './mongoose-test.module';

let testingModule: TestingModule;

export async function setupIntegrationTests(metadata: ModuleMetadata) {
  testingModule = await Test.createTestingModule({
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
  }).compile();

  return {
    module: testingModule,
  };
}

export async function teardownIntegrationTests() {
  await testingModule?.close();
  await stopMemoryServer();
}
