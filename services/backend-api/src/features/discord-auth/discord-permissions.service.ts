import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { ADMINISTRATOR, NONE } from "./constants/permissions";

interface MemberPermissionDetails {
  roles: string[];
  user: {
    id: string;
  };
}

interface ChannelPermissionDetails {
  guild_id: string;
  permission_overwrites: Array<{
    id: string;
    allow: string;
    deny: string;
  }>;
}

interface GuildPermissionDetails {
  id: string;
  owner_id: string;
  roles: Array<{
    id: string;
    permissions: string;
  }>;
}

@Injectable()
export class DiscordPermissionsService {
  constructor(
    private readonly discordApiService: DiscordAPIService,
    private readonly configService: ConfigService
  ) {}

  async botHasPermissionInChannel(
    channel: ChannelPermissionDetails,
    permissions: bigint[]
  ) {
    const botUserId = this.configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    ) as string;

    return this.userHasPermissionInChannel(botUserId, channel, permissions);
  }

  async botHasPermissionInServer(guildId: string, permissions: bigint[]) {
    const userId = this.configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    ) as string;

    const [guild, guildMember] = await Promise.all([
      this.discordApiService.getGuild(guildId),
      this.discordApiService.getGuildMember(guildId, userId),
    ]);

    const basePermissions = this.computeBasePermissions(guildMember, guild);

    if ((basePermissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return true;
    }

    return permissions.every(
      (permission) => (basePermissions & permission) === permission
    );
  }

  async userHasPermissionInChannel(
    userId: string,
    channel: ChannelPermissionDetails,
    permsToCheck: bigint[]
  ) {
    const permissions = await this.computePermissions(userId, channel);

    return this.computedPermissionsHasPermissions(permissions, permsToCheck);
  }

  computedPermissionsHasPermissions(
    permissions: bigint,
    permissionsToCheck: bigint[]
  ) {
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return true;
    }

    return permissionsToCheck.every(
      (permission) => (permissions & permission) === permission
    );
  }

  async computePermissions(userId: string, channel: ChannelPermissionDetails) {
    const [guild, guildMember] = await Promise.all([
      this.discordApiService.getGuild(channel.guild_id),
      this.discordApiService.getGuildMember(channel.guild_id, userId),
    ]);

    const basePermissions = this.computeBasePermissions(guildMember, guild);

    return this.computeOverwritePermissions(
      basePermissions,
      guildMember,
      channel
    );
  }

  computeBasePermissions(
    guildMember: MemberPermissionDetails,
    guild: GuildPermissionDetails
  ) {
    if (guild.owner_id === guildMember.user.id) {
      return ADMINISTRATOR;
    }

    // Get the @everyone role and compute their permissions
    const everyoneRole = guild.roles.find(
      (role) => role.id === guild.id
    ) as GuildPermissionDetails["roles"][number];

    let everyoneRolePermissions = BigInt(everyoneRole.permissions);

    if (everyoneRolePermissions & ADMINISTRATOR) {
      return ADMINISTRATOR;
    }

    for (const roleId of guildMember.roles) {
      const role = guild.roles.find(
        (role) => role.id === roleId
      ) as GuildPermissionDetails["roles"][number];

      everyoneRolePermissions |= BigInt(role.permissions);
    }

    return everyoneRolePermissions;
  }

  computeOverwritePermissions(
    basePermissions: bigint,
    member: MemberPermissionDetails,
    channel: ChannelPermissionDetails
  ) {
    if (basePermissions & ADMINISTRATOR) {
      return ADMINISTRATOR;
    }

    let permissions = basePermissions;
    const channelOverwrites = channel.permission_overwrites;
    // Apply @everyone role overwrites
    const overwriteEveryone = channelOverwrites.find(
      (overwrite) => overwrite.id === channel.guild_id
    );

    if (overwriteEveryone) {
      permissions &= ~BigInt(overwriteEveryone.deny);
      permissions |= BigInt(overwriteEveryone.allow);
    }

    // Apply role-specific overwrites
    let allow = NONE;
    let deny = NONE;

    for (const roleId of member.roles) {
      const overwriteRole = channelOverwrites.find(
        (overwrite) => overwrite.id === roleId
      );

      if (overwriteRole) {
        allow |= BigInt(overwriteRole.allow);
        deny |= BigInt(overwriteRole.deny);
      }
    }

    permissions &= ~deny;
    permissions |= allow;

    // Apply member specific overwrites
    const overwriteMember = channelOverwrites.find(
      (overwrite) => overwrite.id === member.user.id
    );

    if (overwriteMember) {
      permissions &= ~BigInt(overwriteMember.deny);
      permissions |= BigInt(overwriteMember.allow);
    }

    return permissions;
  }
}
