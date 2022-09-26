import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule, MongooseModuleOptions } from "@nestjs/mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer;

interface Options {
  mongooseOptions?: MongooseModuleOptions;
}

@Module({})
export class MongooseTestModule {
  static async forRoot(options?: Options): Promise<DynamicModule> {
    memoryServer = await MongoMemoryServer.create();

    return {
      module: MongooseTestModule,
      imports: [
        MongooseModule.forRoot(await memoryServer.getUri(), {
          ...options?.mongooseOptions,
          retryAttempts: 0,
        }),
      ],
    };
  }
}

export const stopMemoryServer = () => memoryServer?.stop();
