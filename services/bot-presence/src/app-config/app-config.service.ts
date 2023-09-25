import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getBotToken() {
    return this.configService.getOrThrow<string>('BOT_TOKEN');
  }
}
