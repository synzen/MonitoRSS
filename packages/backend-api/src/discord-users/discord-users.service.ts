import { Injectable } from '@nestjs/common';
import { DiscordAPIService } from '../services/apis/discord/discord-api.service';

export interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: string;
  features: string[];
}

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
  ) {
    const iconSize = options?.guildIconSize || '128';
    const iconFormat = options?.guildIconFormat || 'png';
    const endpoint = this.BASE_ENDPOINT + `/@me/guilds`;

    const guilds = await this.discordApiService.executeBearerRequest<
      DiscordPartialGuild[]
    >(accessToken, endpoint);

    return guilds.map((guild) => ({
      ...guild,
      icon_url:
        `https://cdn.discordapp.com/icons` +
        `/${guild.id}/${guild.icon}.${iconFormat}?size=${iconSize}`,
    }));
  }
}
