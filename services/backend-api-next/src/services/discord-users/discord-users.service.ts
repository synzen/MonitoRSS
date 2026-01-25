import type { Config } from "../../config";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { SupportersService } from "../supporters/supporters.service";
import type {
  DiscordBotUser,
  DiscordUser,
  DiscordUserFormatted,
  PartialUserGuild,
  PartialUserGuildFormatted,
  UpdateSupporterInput,
  GetGuildsOptions,
} from "./types";
import { MANAGE_CHANNEL } from "../../shared/constants/permissions";

export interface DiscordUsersServiceDeps {
  config: Config;
  discordApiService: DiscordApiService;
  supportersService: SupportersService;
}

export class DiscordUsersService {
  private readonly BASE_ENDPOINT = "/users";

  constructor(private readonly deps: DiscordUsersServiceDeps) {}

  async getBot(): Promise<DiscordBotUser> {
    const bot = await this.deps.discordApiService.getBot();
    let avatarUrl: string | null = null;

    if (bot.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png`;
    }

    return {
      username: bot.username,
      id: bot.id,
      avatar: avatarUrl,
    };
  }

  async getUserById(userId: string): Promise<DiscordUser> {
    const url = `${this.BASE_ENDPOINT}/${userId}`;
    const user = await this.deps.discordApiService.executeBotRequest<DiscordUser>(
      url,
      { method: "GET" }
    );

    let avatarUrl: string | null = null;

    if (user.avatar) {
      const extension = user.avatar.startsWith("a_") ? ".gif" : ".png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}${extension}`;
    }

    return {
      username: user.username,
      id: user.id,
      avatar: avatarUrl,
      discriminator: user.discriminator,
    };
  }

  async getGuilds(
    accessToken: string,
    options?: GetGuildsOptions
  ): Promise<PartialUserGuildFormatted[]> {
    const iconSize = options?.guildIconSize || "128";
    const iconFormat = options?.guildIconFormat || "png";
    const endpoint = `${this.BASE_ENDPOINT}/@me/guilds`;

    const guilds = await this.deps.discordApiService.executeBearerRequest<
      PartialUserGuild[]
    >(accessToken, endpoint);

    const guildsWithPermission = guilds.filter(
      (guild) =>
        guild.owner ||
        (BigInt(guild.permissions) & MANAGE_CHANNEL) === MANAGE_CHANNEL
    );

    const guildIds = guildsWithPermission.map((guild) => guild.id);
    const guildBenefits = await this.deps.supportersService.getBenefitsOfServers(
      guildIds
    );

    return guildsWithPermission.map((guild, index) => {
      const benefits = guildBenefits[index]!;

      return {
        ...guild,
        iconUrl:
          `https://cdn.discordapp.com/icons` +
          `/${guild.id}/${guild.icon}.${iconFormat}?size=${iconSize}`,
        benefits: {
          maxFeeds: benefits.maxFeeds,
          webhooks: benefits.webhooks,
        },
      };
    });
  }

  async getUser(accessToken: string): Promise<DiscordUserFormatted> {
    const endpoint = `${this.BASE_ENDPOINT}/@me`;

    const user = await this.deps.discordApiService.executeBearerRequest<DiscordUser>(
      accessToken,
      endpoint
    );

    const benefits = await this.deps.supportersService.getBenefitsOfDiscordUser(
      user.id
    );

    const toReturn: DiscordUserFormatted = {
      id: user.id,
      discriminator: user.discriminator,
      username: user.username,
      avatar: user.avatar,
      maxFeeds: benefits.maxFeeds,
      maxUserFeeds: benefits.maxUserFeeds,
      maxUserFeedsComposition: benefits.maxUserFeedsComposition,
      allowCustomPlaceholders: benefits.allowCustomPlaceholders,
    };

    if (benefits.isSupporter) {
      toReturn.supporter = {
        guilds: benefits.guilds,
        maxFeeds: benefits.maxFeeds,
        maxGuilds: benefits.maxGuilds,
        expireAt: benefits.expireAt,
      };
    }

    if (user.avatar) {
      toReturn.avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }

    return toReturn;
  }

  async updateSupporter(
    userId: string,
    data: UpdateSupporterInput
  ): Promise<void> {
    if (data.guildIds) {
      await this.deps.supportersService.setGuilds(userId, data.guildIds);
    }
  }
}
