import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config';
import { validateConfig } from './config/validate';
import { FeedFetcherModule } from './feed-fetcher/feed-fetcher.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqsPollingService } from './shared/services/sqs-polling.service';

@Module({
  imports: [FeedFetcherModule],
  controllers: [AppController],
  providers: [AppService, SqsPollingService],
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
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: configVals.POSTGRES_URI,
          // database: 'feedfetcher',
          entities: [],
          synchronize: configVals.SYNC_DB,
          autoLoadEntities: true,
        }),
      ],
    };
  }
}
