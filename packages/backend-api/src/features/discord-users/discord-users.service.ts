import { Injectable } from '@nestjs/common';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import { DiscordUser, DiscordUserFormatted } from './types/DiscordUser.type';
import {
  PartialUserGuild,
  PartialUserGuildFormatted,
} from './types/PartialUserGuild.type';

@Injectable()
export class DiscordUsersService {
  BASE_ENDPOINT = '/users';

  constructor(private readonly discordApiService: DiscordAPIService) {}

  /**
   * Get a user's guilds.
   *
   * @param accessToken The user's OAuth2 access token
   * @param options Options for the request
   * @returns The user's list of partial guilds
   */
  async getGuilds(
    accessToken: string,
    options?: {
      guildIconSize?: string;
      guildIconFormat?: 'png' | 'jpeg' | 'webp' | 'gif';
    },
  ): Promise<PartialUserGuildFormatted[]> {
    const iconSize = options?.guildIconSize || '128';
    const iconFormat = options?.guildIconFormat || 'png';
    const endpoint = this.BASE_ENDPOINT + `/@me/guilds`;

    const guilds = await this.discordApiService.executeBearerRequest<
      PartialUserGuild[]
    >(accessToken, endpoint);

    const MANAGE_CHANNEL_PERMISSION = 16;

    const guildsWithPermission = guilds.filter(
      (guild) =>
        guild.owner ||
        (guild.permissions & MANAGE_CHANNEL_PERMISSION) ===
          MANAGE_CHANNEL_PERMISSION,
    );

    return guildsWithPermission.map((guild) => ({
      ...guild,
      iconUrl:
        `https://cdn.discordapp.com/icons` +
        `/${guild.id}/${guild.icon}.${iconFormat}?size=${iconSize}`,
    }));
  }

  /**
   * Get a user via their OAuth2 access token.
   *
   * @param accessToken The user's OAuth2 access token
   * @returns The user's information
   */
  async getUser(accessToken: string): Promise<DiscordUserFormatted> {
    const endpoint = this.BASE_ENDPOINT + `/@me`;

    const user = await this.discordApiService.executeBearerRequest<DiscordUser>(
      accessToken,
      endpoint,
    );

    const toReturn: DiscordUserFormatted = {
      ...user,
    };

    if (user.avatar) {
      toReturn.avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }

    return toReturn;
  }
}
