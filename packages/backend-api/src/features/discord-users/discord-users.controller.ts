import {
  Body,
  CacheTTL,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HttpCacheInterceptor } from '../../common/interceptors/http-cache-interceptor';
import { TransformValidationPipe } from '../../common/pipes/TransformValidationPipe';
import { DiscordAccessToken } from '../discord-auth/decorators/DiscordAccessToken';
import { DiscordOAuth2Guard } from '../discord-auth/guards/DiscordOAuth2.guard';
import { SessionAccessToken } from '../discord-auth/types/SessionAccessToken.type';
import { DiscordUsersService } from './discord-users.service';
import { GetMeOutputDto, UpdateSupporterInputDto } from './dto';
import { GetMyServersOutputDto } from './dto/GetMyServersOutput.dto';
import { DiscordUserIsSupporterGuard } from './guards/DiscordUserIsSupporter';

@Controller('discord-users')
@UseGuards(DiscordOAuth2Guard)
export class DiscordUsersController {
  constructor(private readonly discordUsersService: DiscordUsersService) {}

  @Get('@me')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 60)
  async getMe(
    @DiscordAccessToken() accessToken: SessionAccessToken,
  ): Promise<GetMeOutputDto> {
    const user = await this.discordUsersService.getUser(
      accessToken.access_token,
    );

    return {
      id: user.id,
      username: user.username,
      iconUrl: user.avatarUrl,
      supporter: user.supporter,
    };
  }

  @Patch('@me/supporter')
  @UseGuards(DiscordUserIsSupporterGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateSupporter(
    @DiscordAccessToken() accessToken: SessionAccessToken,
    @Body(TransformValidationPipe) input: UpdateSupporterInputDto,
  ) {
    await this.discordUsersService.updateSupporter(accessToken.discord.id, {
      guildIds: input.guildIds,
    });
  }

  @Get('@me/servers')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getMyServers(
    @DiscordAccessToken() accessToken: SessionAccessToken,
  ): Promise<GetMyServersOutputDto> {
    const guilds = await this.discordUsersService.getGuilds(
      accessToken.access_token,
    );

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
