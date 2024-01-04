import { Injectable } from "@nestjs/common";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { MANAGE_CHANNEL } from "../discord-auth/constants/permissions";
import { SupportersService } from "../supporters/supporters.service";
import { DiscordBotUser } from "./types/discord-bot-user.type";
import { DiscordUser, DiscordUserFormatted } from "./types/DiscordUser.type";
import {
  PartialUserGuild,
  PartialUserGuildFormatted,
} from "./types/PartialUserGuild.type";

interface UpdateSupporterInput {
  guildIds?: string[];
}

@Injectable()
export class DiscordUsersService {
  BASE_ENDPOINT = "/users";

  constructor(
    private readonly discordApiService: DiscordAPIService,
    private readonly supportersService: SupportersService
  ) {}

  async getBot(): Promise<DiscordBotUser> {
    const bot = await this.discordApiService.getBot();
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
    const user: DiscordUser = await this.discordApiService.executeBotRequest(
      url,
      {
        method: "GET",
      }
    );
    let avatarUrl: string | null = null;

    if (user.avatar) {
      let extension = ".png";

      if (user.avatar.startsWith("a_")) {
        extension = ".gif";
      }

      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}${extension}`;
    }

    return {
      username: user.username,
      id: user.id,
      avatar: avatarUrl,
      discriminator: user.discriminator,
    };
  }

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
      guildIconFormat?: "png" | "jpeg" | "webp" | "gif";
    }
  ): Promise<PartialUserGuildFormatted[]> {
    const iconSize = options?.guildIconSize || "128";
    const iconFormat = options?.guildIconFormat || "png";
    const endpoint = this.BASE_ENDPOINT + `/@me/guilds`;

    const guilds = await this.discordApiService.executeBearerRequest<
      PartialUserGuild[]
    >(accessToken, endpoint);

    const guildsWithPermission = guilds.filter(
      (guild) =>
        guild.owner ||
        (BigInt(guild.permissions) & MANAGE_CHANNEL) === MANAGE_CHANNEL
    );

    const guildIds = guildsWithPermission.map((guild) => guild.id);
    const guildBenefits = await this.supportersService.getBenefitsOfServers(
      guildIds
    );

    return guildsWithPermission.map((guild, index) => {
      const benefits = guildBenefits[index];

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
      endpoint
    );

    const [benefits, supportersEnabled] = await Promise.all([
      this.supportersService.getBenefitsOfDiscordUser(user.id),
      this.supportersService.areSupportersEnabled(),
    ]);

    const toReturn: DiscordUserFormatted = {
      id: user.id,
      discriminator: user.discriminator,
      username: user.username,
      avatar: user.avatar,
      maxFeeds: benefits.maxFeeds,
      maxUserFeeds: benefits.maxUserFeeds,
      maxUserFeedsComposition: benefits.maxUserFeedsComposition,
      refreshRates: [
        {
          rateSeconds: this.supportersService.defaultRefreshRateSeconds,
        },
        {
          rateSeconds: this.supportersService.defaultRefreshRateSeconds * 6,
        },
      ],
      allowCustomPlaceholders: benefits.allowCustomPlaceholders,
    };

    if (supportersEnabled) {
      toReturn.refreshRates.unshift({
        rateSeconds: this.supportersService.defaultSupporterRefreshRateSeconds,
        disabledCode:
          benefits.refreshRateSeconds >=
          this.supportersService.defaultRefreshRateSeconds
            ? "INSUFFICIENT_SUPPORTER_TIER"
            : undefined,
      });
    }

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

  async updateSupporter(userId: string, data: UpdateSupporterInput) {
    if (data.guildIds) {
      await this.supportersService.setGuilds(userId, data.guildIds);
    }
  }
}
