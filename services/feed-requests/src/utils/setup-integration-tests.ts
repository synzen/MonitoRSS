import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ModelDefinition } from '@nestjs/mongoose';
import { testConfig } from '../config/test.config';
import { MongoMemoryServer } from 'mongodb-memory-server';

let testingModule: TestingModule;
let mongod: MongoMemoryServer;

interface Options {
  feedMongoModels?: ModelDefinition[];
}

export async function setupIntegrationTests(
  metadata: ModuleMetadata,
  options?: Options,
) {
  mongod = await MongoMemoryServer.create();
  const mongodbUri = mongod.getUri();

  const uncompiledModule = Test.createTestingModule({
    ...metadata,
    imports: [
      ...(metadata.imports || []),
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => testConfig],
        isGlobal: true,
      }),
      MongooseModule.forRoot(mongodbUri, {
        autoIndex: false,
        retryAttempts: 0,
      }),
      MongooseModule.forFeature(options?.feedMongoModels || []),
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
  await mongod?.stop();
}
