import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { config } from "./config";
import { FeedFetcherModule } from "./feed-fetcher/feed-fetcher.module";
import { ArticlesModule } from "./articles/articles.module";
// eslint-disable-next-line max-len
import { PostgresTestingModuleModule } from "./common/shared/postgres-testing-module/postgres-testing-module.module";

@Module({
  imports: [FeedFetcherModule, ArticlesModule, PostgresTestingModuleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configVals = config();

    return {
      module: AppModule,
      imports: [
        MikroOrmModule.forRoot({
          autoLoadEntities: true,
          clientUrl: configVals.POSTGRES_URI,
          dbName: configVals.POSTGRES_DATABASE,
          type: "postgresql",
          forceUtcTimezone: true,
          timezone: "UTC",
        }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [config],
        }),
      ],
    };
  }
}
