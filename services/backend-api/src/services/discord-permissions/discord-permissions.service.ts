import type { Config } from "../../config";
import {
  ADMINISTRATOR,
  NONE,
} from "../../shared/constants/discord-permissions";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type {
  ChannelPermissionDetails,
  GuildPermissionDetails,
  MemberPermissionDetails,
} from "./types";

export class DiscordPermissionsService {
  private readonly botUserId: string;

  constructor(
    private readonly config: Config,
    private readonly discordApiService: DiscordApiService,
  ) {
    this.botUserId = config.BACKEND_API_DISCORD_CLIENT_ID;
  }

  async botHasPermissionInChannel(
    channel: ChannelPermissionDetails,
    permissions: bigint[],
  ): Promise<boolean> {
    return this.userHasPermissionInChannel(
      this.botUserId,
      channel,
      permissions,
    );
  }

  async botHasPermissionInServer(
    guildId: string,
    permissions: bigint[],
  ): Promise<boolean> {
    const [guild, guildMember] = await Promise.all([
      this.discordApiService.getGuild(guildId),
      this.discordApiService.getGuildMember(guildId, this.botUserId),
    ]);

    const basePermissions = this.computeBasePermissions(guildMember, guild);

    if ((basePermissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return true;
    }

    return permissions.every(
      (permission) => (basePermissions & permission) === permission,
    );
  }

  async userHasPermissionInChannel(
    userId: string,
    channel: ChannelPermissionDetails,
    permsToCheck: bigint[],
  ): Promise<boolean> {
    const permissions = await this.computePermissions(userId, channel);

    return this.computedPermissionsHasPermissions(permissions, permsToCheck);
  }

  computedPermissionsHasPermissions(
    permissions: bigint,
    permissionsToCheck: bigint[],
  ): boolean {
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return true;
    }

    return permissionsToCheck.every(
      (permission) => (permissions & permission) === permission,
    );
  }

  async computePermissions(
    userId: string,
    channel: ChannelPermissionDetails,
  ): Promise<bigint> {
    const [guild, guildMember] = await Promise.all([
      this.discordApiService.getGuild(channel.guild_id),
      this.discordApiService.getGuildMember(channel.guild_id, userId),
    ]);

    const basePermissions = this.computeBasePermissions(guildMember, guild);

    return this.computeOverwritePermissions(
      basePermissions,
      guildMember,
      channel,
    );
  }

  computeBasePermissions(
    guildMember: MemberPermissionDetails,
    guild: GuildPermissionDetails,
  ): bigint {
    if (guild.owner_id === guildMember.user.id) {
      return ADMINISTRATOR;
    }

    const everyoneRole = guild.roles.find(
      (role) => role.id === guild.id,
    ) as GuildPermissionDetails["roles"][number];

    let everyoneRolePermissions = BigInt(everyoneRole.permissions);

    if (everyoneRolePermissions & ADMINISTRATOR) {
      return ADMINISTRATOR;
    }

    for (const roleId of guildMember.roles) {
      const role = guild.roles.find(
        (role) => role.id === roleId,
      ) as GuildPermissionDetails["roles"][number];

      everyoneRolePermissions |= BigInt(role.permissions);
    }

    return everyoneRolePermissions;
  }

  computeOverwritePermissions(
    basePermissions: bigint,
    member: MemberPermissionDetails,
    channel: ChannelPermissionDetails,
  ): bigint {
    if (basePermissions & ADMINISTRATOR) {
      return ADMINISTRATOR;
    }

    let permissions = basePermissions;
    const channelOverwrites = channel.permission_overwrites;

    const overwriteEveryone = channelOverwrites.find(
      (overwrite) => overwrite.id === channel.guild_id,
    );

    if (overwriteEveryone) {
      permissions &= ~BigInt(overwriteEveryone.deny);
      permissions |= BigInt(overwriteEveryone.allow);
    }

    let allow = NONE;
    let deny = NONE;

    for (const roleId of member.roles) {
      const overwriteRole = channelOverwrites.find(
        (overwrite) => overwrite.id === roleId,
      );

      if (overwriteRole) {
        allow |= BigInt(overwriteRole.allow);
        deny |= BigInt(overwriteRole.deny);
      }
    }

    permissions &= ~deny;
    permissions |= allow;

    const overwriteMember = channelOverwrites.find(
      (overwrite) => overwrite.id === member.user.id,
    );

    if (overwriteMember) {
      permissions &= ~BigInt(overwriteMember.deny);
      permissions |= BigInt(overwriteMember.allow);
    }

    return permissions;
  }
}
