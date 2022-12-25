import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config';
import { FeedFetcherModule } from './feed-fetcher/feed-fetcher.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configVals = config();

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [config],
        }),
        FeedFetcherModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: configVals.FEED_FETCHER_POSTGRES_URI,
          // database: 'feedfetcher',
          entities: [],
          synchronize: configVals.FEED_FETCHER_SYNC_DB,
          autoLoadEntities: true,
        }),
      ],
    };
  }
}
