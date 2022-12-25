import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config';
import { FeedFetcherModule } from './feed-fetcher/feed-fetcher.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
        MikroOrmModule.forRoot({
          entities: ['dist/**/*.entity.js'],
          entitiesTs: ['src/**/*.entity.ts'],
          clientUrl: configVals.FEED_REQUESTS_POSTGRES_URI,
          type: 'postgresql',
          forceUtcTimezone: true,
          timezone: 'UTC',
        }),
      ],
    };
  }
}
