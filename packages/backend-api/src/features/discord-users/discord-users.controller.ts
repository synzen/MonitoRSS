import { Controller, Get, UseGuards } from '@nestjs/common';
import { DiscordAccessToken } from '../discord-auth/decorators/DiscordAccessToken';
import { DiscordOAuth2Guard } from '../discord-auth/guards/DiscordOAuth2.guard';
import { DiscordUsersService } from './discord-users.service';
import { GetMeOutputDto } from './dto';
import { GetMyServersOutputDto } from './dto/GetMyServersOutput.dto';

@Controller('discord-users')
@UseGuards(DiscordOAuth2Guard)
export class DiscordUsersController {
  constructor(private readonly discordUsersService: DiscordUsersService) {}

  @Get('@me')
  async getMe(
    @DiscordAccessToken() accessToken: string,
  ): Promise<GetMeOutputDto> {
    const user = await this.discordUsersService.getUser(accessToken);

    return {
      id: user.id,
      username: user.username,
      iconUrl: user.avatarUrl,
    };
  }

  @Get('@me/servers')
  async getMyServers(
    @DiscordAccessToken() accessToken: string,
  ): Promise<GetMyServersOutputDto> {
    const guilds = await this.discordUsersService.getGuilds(accessToken);

    const data = guilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      benefits: {
        maxFeeds: guild.benefits.maxFeeds,
        webhooks: guild.benefits.webhooks,
      },
    }));

    return {
      results: data,
      total: data.length,
    };
  }
}
