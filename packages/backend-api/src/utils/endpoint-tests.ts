import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { stopMemoryServer } from './mongoose-test.module';

let testingModule: TestingModule;
let app: NestFastifyApplication;

export function setupEndpointTests(metadata: ModuleMetadata) {
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
    app = testingModule.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    useContainer(app, { fallbackOnErrors: true });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    return {
      app,
    };
  };

  return {
    uncompiledModule,
    init,
  };
}

export async function teardownEndpointTests() {
  await app?.close();
  await testingModule?.close();
  await stopMemoryServer();
}
