import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { FeedsService } from "../feeds/feeds.service";
import {
  DiscordServerProfile,
  DiscordServerProfileModel,
} from "./entities/discord-server-profile.entity";
import {
  DiscordGuild,
  DiscordGuildRole,
  DiscordGuildChannel,
  DiscordChannelType,
  DiscordGuildMember,
} from "../../common";

import { DiscordGuildChannelFormatted, ProfileSettings } from "./types";
import { DiscordServerNotFoundException } from "./exceptions";
import { DiscordPermissionsService } from "../discord-auth/discord-permissions.service";
import { MANAGE_THREADS } from "../discord-auth/constants/permissions";
import { URLSearchParams } from "url";

@Injectable()
export class DiscordServersService {
  defaultDateFormat: string;
  defaultTimezone: string;
  defaultDateLanguage: string;

  constructor(
    @InjectModel(DiscordServerProfile.name)
    private readonly profileModel: DiscordServerProfileModel,
    private readonly configService: ConfigService,
    private readonly discordApiService: DiscordAPIService,
    private readonly feedsService: FeedsService,
    private readonly discordPermissionsService: DiscordPermissionsService
  ) {
    this.defaultDateFormat = this.configService.get<string>(
      "BACKEND_API_DEFAULT_DATE_FORMAT"
    ) as string;
    this.defaultTimezone = this.configService.get<string>(
      "BACKEND_API_DEFAULT_TIMEZONE"
    ) as string;
    this.defaultDateLanguage = this.configService.get<string>(
      "BACKEND_API_DEFAULT_DATE_LANGUAGE"
    ) as string;
  }

  async getActiveThreads(
    guildId: string,
    options?: {
      includePrivate?: boolean;
      parentChannelId?: string;
    }
  ): Promise<DiscordGuildChannelFormatted[]> {
    const { threads }: { threads: DiscordGuildChannel[] } =
      await this.discordApiService.executeBotRequest(
        `/guilds/${guildId}/threads/active`,
        {
          method: "GET",
        }
      );

    return threads
      .filter((thread) => {
        if (options?.includePrivate) {
          return true;
        }

        if (options?.parentChannelId) {
          return thread.parent_id === options.parentChannelId;
        }
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
    const profile = await this.profileModel.findById(serverId);

    return this.getProfileSettingsWithDefaults(profile);
  }

  async getGuild(guildId: string): Promise<{ exists: boolean }> {
    try {
      await this.discordApiService.getGuild(guildId);

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
    }
  ) {
    const toUpdate: { $set: Partial<DiscordServerProfile> } = {
      $set: {},
    };

    if (updates.dateFormat) {
      toUpdate.$set.dateFormat = updates.dateFormat;
    }

    if (updates.dateLanguage) {
      toUpdate.$set.dateLanguage = updates.dateLanguage;
    }

    if (updates.timezone) {
      toUpdate.$set.timezone = updates.timezone;
    }

    const updated = await this.profileModel.findOneAndUpdate(
      { _id: serverId },
      toUpdate,
      {
        upsert: true,
        new: true,
      }
    );

    return this.getProfileSettingsWithDefaults(updated);
  }

  async getServer(serverId: string) {
    try {
      const guild: DiscordGuild =
        await this.discordApiService.executeBotRequest(`/guilds/${serverId}`);

      return guild;
    } catch (err) {
      const statusCodeForNull = [HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN];

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
    }
  ): Promise<DiscordGuildChannelFormatted[]> {
    try {
      const channels: DiscordGuildChannel[] =
        await this.discordApiService.executeBotRequest(
          `/guilds/${serverId}/channels`
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

        if (
          c.type === DiscordChannelType.GUILD_TEXT ||
          c.type === DiscordChannelType.GUILD_ANNOUNCEMENT
        ) {
          return true;
        }
      });

      let botCanUseModeratedTags = true;

      if (
        relevantChannels.some((c) => c.available_tags?.some((t) => t.moderated))
      ) {
        botCanUseModeratedTags =
          await this.discordPermissionsService.botHasPermissionInServer(
            serverId,
            [MANAGE_THREADS]
          );
      }

      const formattedChannels = relevantChannels.map((channel) => {
        const parentChannel =
          channel.parent_id &&
          (channels.find((c) => c.id === channel.parent_id) as
            | DiscordGuildChannel
            | undefined);

        return {
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
          availableTags: channel.available_tags
            ?.map((t) => ({
              id: t.id,
              name: t.name,
              emojiId: t.emoji_id,
              emojiName: t.emoji_name,
              hasPermissionToUse: t.moderated ? botCanUseModeratedTags : true,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });

      return formattedChannels;
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        [404, 403].includes(err.statusCode)
      ) {
        throw new DiscordServerNotFoundException(
          `Discord server ${serverId} does not exist`
        );
      }

      throw err;
    }
  }

  async getRolesOfServer(serverId: string) {
    const roles: DiscordGuildRole[] =
      await this.discordApiService.executeBotRequest(
        `/guilds/${serverId}/roles`
      );

    return roles;
  }

  async searchMembersOfServer(
    serverId: string,
    data: {
      search?: string;
      limit?: number;
    }
  ) {
    const params = new URLSearchParams();
    params.set("query", data.search || "");
    params.set("limit", String(data.limit || 10));

    const res: DiscordGuildMember[] =
      await this.discordApiService.executeBotRequest(
        `/guilds/${serverId}/members/search?${params.toString()}`,
        {
          method: "GET",
        }
      );

    return res;
  }

  async getMemberOfServer(
    serverId: string,
    memberId: string
  ): Promise<DiscordGuildMember | null> {
    try {
      return await this.discordApiService.getGuildMember(serverId, memberId);
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        [HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN].includes(err.statusCode)
      ) {
        return null;
      }

      throw err;
    }
  }

  private getProfileSettingsWithDefaults(
    profile?: DiscordServerProfile | null
  ) {
    return {
      dateFormat: profile?.dateFormat || this.defaultDateFormat,
      timezone: profile?.timezone || this.defaultTimezone,
      dateLanguage: profile?.dateLanguage || this.defaultDateLanguage,
    };
  }
}
