import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config/config';
import { validateConfig } from './config/config.validate';
import testConfig from './config/test-config';
import { DiscordAuthModule } from './features/discord-auth/discord-auth.module';
import { DiscordServersModule } from './features/discord-servers/discord-servers.module';
import { DiscordUserModule } from './features/discord-users/discord-users.module';
import { DiscordWebhooksModule } from './features/discord-webhooks/discord-webhooks.module';
import { FeedsModule } from './features/feeds/feeds.module';
import { SupportersModule } from './features/supporters/supporters.module';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    DiscordAuthModule,
    DiscordUserModule,
    DiscordServersModule,
    FeedsModule,
    DiscordWebhooksModule,
    SupportersModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: AppModule,
      imports: [
        MongooseModule.forRoot(configValues.mongodbUri),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [process.env.NODE_ENV === 'test' ? testConfig : config],
          validate: validateConfig,
        }),
      ],
    };
  }

  static forTest(): DynamicModule {
    return {
      module: AppModule,
      imports: [],
    };
  }
}
