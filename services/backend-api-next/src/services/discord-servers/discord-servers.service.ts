import type { Config } from "../../config";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { FeedsService } from "../feeds/feeds.service";
import type { DiscordPermissionsService } from "../discord-permissions/discord-permissions.service";
import type { IDiscordServerProfileRepository } from "../../repositories/interfaces/discord-server-profile.types";
import type { ProfileSettings, DiscordGuildChannelFormatted } from "./types";
import {
  DiscordChannelType,
  type DiscordGuild,
  type DiscordGuildRole,
  type DiscordGuildMember,
  type DiscordGuildChannel,
} from "../../shared/types/discord.types";
import type { DetailedFeed } from "../feeds/types";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import { DiscordServerNotFoundException } from "../../shared/exceptions/discord-servers.exceptions";
import { MANAGE_THREADS } from "../../shared/constants/discord-permissions";

export interface DiscordServersServiceDeps {
  config: Config;
  discordApiService: DiscordApiService;
  feedsService: FeedsService;
  discordPermissionsService: DiscordPermissionsService;
  discordServerProfileRepository: IDiscordServerProfileRepository;
}

export class DiscordServersService {
  private readonly defaultDateFormat: string;
  private readonly defaultTimezone: string;
  private readonly defaultDateLanguage: string;

  constructor(private readonly deps: DiscordServersServiceDeps) {
    this.defaultDateFormat = deps.config.BACKEND_API_DEFAULT_DATE_FORMAT;
    this.defaultTimezone = deps.config.BACKEND_API_DEFAULT_TIMEZONE;
    this.defaultDateLanguage = deps.config.BACKEND_API_DEFAULT_DATE_LANGUAGE;
  }

  async getActiveThreads(
    guildId: string,
    options?: {
      includePrivate?: boolean;
      parentChannelId?: string;
    },
  ): Promise<DiscordGuildChannelFormatted[]> {
    const { threads }: { threads: DiscordGuildChannel[] } =
      await this.deps.discordApiService.executeBotRequest(
        `/guilds/${guildId}/threads/active`,
        { method: "GET" },
      );

    return threads
      .filter((thread) => {
        if (options?.includePrivate) {
          return true;
        }

        if (options?.parentChannelId) {
          return thread.parent_id === options.parentChannelId;
        }

        return thread.type !== DiscordChannelType.PRIVATE_THREAD;
      })
      .map((channel) => ({
        id: channel.id,
        category: null,
        guild_id: channel.guild_id,
        name: channel.name,
        type: channel.type,
        availableTags: [],
      }));
  }

  async getServerProfile(serverId: string): Promise<ProfileSettings> {
    const profile =
      await this.deps.discordServerProfileRepository.findById(serverId);
    return this.getProfileSettingsWithDefaults(profile);
  }

  async getGuild(guildId: string): Promise<{ exists: boolean }> {
    try {
      await this.deps.discordApiService.getGuild(guildId);
      return { exists: true };
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  async updateServerProfile(
    serverId: string,
    updates: {
      dateFormat?: string;
      dateLanguage?: string;
      timezone?: string;
    },
  ): Promise<ProfileSettings> {
    const updated =
      await this.deps.discordServerProfileRepository.findOneAndUpdate(
        serverId,
        updates,
        { upsert: true },
      );
    return this.getProfileSettingsWithDefaults(updated);
  }


  async getServer(serverId: string): Promise<DiscordGuild | null> {
    try {
      const guild: DiscordGuild =
        await this.deps.discordApiService.executeBotRequest(
          `/guilds/${serverId}`,
        );
      return guild;
    } catch (err) {
      const statusCodeForNull = [404, 403];
      if (
        err instanceof DiscordAPIError &&
        statusCodeForNull.includes(err.statusCode)
      ) {
        return null;
      }
      throw err;
    }
  }

  async getTextChannelsOfServer(
    serverId: string,
    options?: {
      types?: Array<string>;
    },
  ): Promise<DiscordGuildChannelFormatted[]> {
    try {
      const channels: DiscordGuildChannel[] =
        await this.deps.discordApiService.executeBotRequest(
          `/guilds/${serverId}/channels`,
        );

      const relevantChannels = channels.filter((c) => {
        if (options?.types) {
          if (options.types.includes("*")) {
            return true;
          }
          if (
            options.types.includes("forum") &&
            c.type === DiscordChannelType.GUILD_FORUM
          ) {
            return true;
          }
          if (
            options.types.includes("text") &&
            c.type === DiscordChannelType.GUILD_TEXT
          ) {
            return true;
          }
          if (
            options.types.includes("announcement") &&
            c.type === DiscordChannelType.GUILD_ANNOUNCEMENT
          ) {
            return true;
          }
          return false;
        }

        return (
          c.type === DiscordChannelType.GUILD_TEXT ||
          c.type === DiscordChannelType.GUILD_ANNOUNCEMENT
        );
      });

      let botCanUseModeratedTags = true;

      if (
        relevantChannels.some((c) => c.available_tags?.some((t) => t.moderated))
      ) {
        botCanUseModeratedTags =
          await this.deps.discordPermissionsService.botHasPermissionInServer(
            serverId,
            [MANAGE_THREADS],
          );
      }

      const formattedChannels = relevantChannels.map((channel) => {
        const parentChannel =
          channel.parent_id &&
          (channels.find((c) => c.id === channel.parent_id) as
            | DiscordGuildChannel
            | undefined);

        const formatted: DiscordGuildChannelFormatted = {
          id: channel.id,
          guild_id: channel.guild_id,
          name: channel.name,
          type: channel.type,
          category: parentChannel
            ? {
                id: parentChannel.id,
                name: parentChannel.name,
              }
            : null,
        };

        if (channel.available_tags) {
          formatted.availableTags = channel.available_tags
            .map((t) => ({
              id: t.id,
              name: t.name,
              emojiId: t.emoji_id,
              emojiName: t.emoji_name,
              hasPermissionToUse: t.moderated ? botCanUseModeratedTags : true,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        return formatted;
      });

      return formattedChannels;
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        [404, 403].includes(err.statusCode)
      ) {
        throw new DiscordServerNotFoundException(
          `Discord server ${serverId} does not exist`,
        );
      }
      throw err;
    }
  }

  async getRolesOfServer(serverId: string): Promise<DiscordGuildRole[]> {
    const roles: DiscordGuildRole[] =
      await this.deps.discordApiService.executeBotRequest(
        `/guilds/${serverId}/roles`,
      );
    return roles;
  }

  async searchMembersOfServer(
    serverId: string,
    data: {
      search?: string;
      limit?: number;
    },
  ): Promise<DiscordGuildMember[]> {
    const params = new URLSearchParams();
    params.set("query", data.search || "");
    params.set("limit", String(data.limit || 10));

    const res: DiscordGuildMember[] =
      await this.deps.discordApiService.executeBotRequest(
        `/guilds/${serverId}/members/search?${params.toString()}`,
        { method: "GET" },
      );

    return res;
  }

  async getMemberOfServer(
    serverId: string,
    memberId: string,
  ): Promise<DiscordGuildMember | null> {
    try {
      return await this.deps.discordApiService.getGuildMember(
        serverId,
        memberId,
      );
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        [404, 403].includes(err.statusCode)
      ) {
        return null;
      }
      throw err;
    }
  }

  private getProfileSettingsWithDefaults(
    profile?: {
      dateFormat?: string;
      timezone?: string;
      dateLanguage?: string;
    } | null,
  ): ProfileSettings {
    return {
      dateFormat: profile?.dateFormat || this.defaultDateFormat,
      timezone: profile?.timezone || this.defaultTimezone,
      dateLanguage: profile?.dateLanguage || this.defaultDateLanguage,
    };
  }
}
