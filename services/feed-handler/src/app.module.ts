import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { config } from "./config";
import { FeedFetcherModule } from "./feed-fetcher/feed-fetcher.module";

@Module({
  imports: [FeedFetcherModule],
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
          type: "postgresql",
          discovery: {
            warnWhenNoEntities: false,
          },
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
