import { DiscordServerRole } from '../types/discord-server-role.type';

interface ServerRoleOutputDto {
  id: string;
  name: string;
  /**
   * Hex color code
   */
  color: string;
}

export class GetServerRolesOutputDto {
  results: ServerRoleOutputDto[];
  total: number;

  static fromEntities(roles: DiscordServerRole[]): GetServerRolesOutputDto {
    return {
      results: roles.map((role) => ({
        id: role.id,
        name: role.name,
        color: `#${role.color.toString(16).padStart(6, '0')}`,
      })),
      total: roles.length,
    };
  }
}
