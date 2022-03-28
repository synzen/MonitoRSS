import { ConfigService } from '@nestjs/config';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import { createTestDiscordGuildChannel } from '../../test/data/discord-guild-channel.test-data';
import { createTestDiscordGuildMember } from '../../test/data/discord-guild-member.test-data';
import { createTestDiscordGuildRole } from '../../test/data/discord-guild-role.test-data';
import { createTestDiscordGuild } from '../../test/data/discord-guild.test-data';
import { ADMINISTRATOR, SEND_CHANNEL_MESSAGE } from './constants/permissions';
import { DiscordPermissionsService } from './discord-permissions.service';

describe('DiscordPermissionsService', () => {
  const discordApiService: DiscordAPIService = {
    getGuild: jest.fn(),
    getChannel: jest.fn(),
    getGuildMember: jest.fn(),
  } as never;
  const configService: ConfigService = {
    get: jest.fn(),
  } as never;
  let permissionsService: DiscordPermissionsService;

  beforeEach(() => {
    permissionsService = new DiscordPermissionsService(
      discordApiService,
      configService,
    );
  });

  describe('computeBasePermissions', () => {
    it('returns correct permissions if @everyone role has administrator', () => {
      const guildMember = createTestDiscordGuildMember({
        roles: ['1', 'everyone-role'],
      });
      const guild = createTestDiscordGuild({
        id: 'everyone-role',
        roles: [
          createTestDiscordGuildRole({
            id: 'everyone-role',
            permissions: ADMINISTRATOR.toString(),
          }),
        ],
      });

      const basePermissions = permissionsService.computeBasePermissions(
        guildMember,
        guild,
      );

      expect(basePermissions & ADMINISTRATOR).toEqual(ADMINISTRATOR);
    });

    it('returns correct permissions if one of user roles has administrator', () => {
      const guildMember = createTestDiscordGuildMember({
        roles: ['guild-id', 'administrator-role', 'random-role'],
      });
      const guild = createTestDiscordGuild({
        id: 'guild-id',
        roles: [
          createTestDiscordGuildRole({
            id: 'administrator-role',
            permissions: ADMINISTRATOR.toString(),
          }),
          createTestDiscordGuildRole({
            id: 'guild-id',
            permissions: '0',
          }),
          createTestDiscordGuildRole({
            id: 'random-role',
            permissions: '0',
          }),
        ],
      });

      const basePermissions = permissionsService.computeBasePermissions(
        guildMember,
        guild,
      );

      expect(basePermissions & ADMINISTRATOR).toEqual(ADMINISTRATOR);
    });

    it('returns correct permissions if one of the users has a non-administrator role', () => {
      const guildMember = createTestDiscordGuildMember({
        roles: ['guild-id', 'random-role'],
      });
      const guild = createTestDiscordGuild({
        id: 'guild-id',
        roles: [
          createTestDiscordGuildRole({
            id: 'guild-id',
            permissions: '0',
          }),
          createTestDiscordGuildRole({
            id: 'random-role',
            permissions: SEND_CHANNEL_MESSAGE.toString(),
          }),
        ],
      });

      const basePermissions = permissionsService.computeBasePermissions(
        guildMember,
        guild,
      );

      expect(basePermissions & SEND_CHANNEL_MESSAGE).toEqual(
        SEND_CHANNEL_MESSAGE,
      );
    });
  });

  describe('computeOverwritePermissions', () => {
    it('returns administrator if base permission has administrator', () => {
      const perm = SEND_CHANNEL_MESSAGE | ADMINISTRATOR;
      const member = createTestDiscordGuildMember();
      const channel = createTestDiscordGuildChannel();

      const overwritePermissions =
        permissionsService.computeOverwritePermissions(perm, member, channel);

      expect(overwritePermissions & ADMINISTRATOR).toEqual(ADMINISTRATOR);
    });
  });
});
