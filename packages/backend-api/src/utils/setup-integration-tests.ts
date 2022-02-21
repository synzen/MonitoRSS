import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

async function setupIntegrationTests(metadata: ModuleMetadata) {
  const module = await Test.createTestingModule({
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
    module,
  };
}

export default setupIntegrationTests;
