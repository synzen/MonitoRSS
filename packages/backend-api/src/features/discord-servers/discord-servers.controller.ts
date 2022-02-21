import { Controller } from '@nestjs/common';
import { DiscordServersService } from './discord-servers.service';

@Controller('discord-servers')
export class DiscordServersController {
  constructor(private readonly discordServersService: DiscordServersService) {}
}
