import { DynamicModule, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppConfigModule } from './app-config/app-config.module';
import { DiscordClientModule } from './discord-client/discord-client.module';

@Module({
  imports: [],
  controllers: [],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: [AppConfigModule.forRoot(), DiscordClientModule.forRoot()],
    };
  }
}
