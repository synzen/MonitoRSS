import { Injectable } from '@nestjs/common';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';

@Injectable()
export class DiscordWebhooksService {
  constructor(private readonly discordApiService: DiscordAPIService) {}
}
