import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer: MongoMemoryServer;

@Module({})
export class MongooseTestModule {
  static async forRoot(
    mongooseOptions?: MongooseModuleOptions,
  ): Promise<DynamicModule> {
    memoryServer = await MongoMemoryServer.create();

    return {
      module: MongooseTestModule,
      imports: [
        MongooseModule.forRoot(await memoryServer.getUri(), {
          ...mongooseOptions,
        }),
      ],
    };
  }
}

export const stopMemoryServer = () => memoryServer.stop();
