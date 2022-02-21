import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config/config';
import { validateConfig } from './config/config.validate';
import { DiscordAuthModule } from './features/discord-auth/discord-auth.module';
import { DiscordServersModule } from './features/discord-servers/discord-servers.module';
import { DiscordUserModule } from './features/discord-users/discord-users.module';
import { FeedsModule } from './features/feeds/feeds.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [config],
      validate: validateConfig,
    }),
    DiscordAuthModule,
    DiscordUserModule,
    DiscordServersModule,
    FeedsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: AppModule,
      imports: [MongooseModule.forRoot(configValues.mongodbUri)],
    };
  }
}
