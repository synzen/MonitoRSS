import { DiscordGuildMember } from "../../../common";
import { DISCORD_CDN_BASE_URL } from "../../../constants/discord";

export interface MemberResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

function buildAvatarUrl(member: DiscordGuildMember): string | null {
  if (!member.user.avatar) {
    return null;
  }

  const extension = member.user.avatar.startsWith("a_") ? ".gif" : ".png";

  return `${DISCORD_CDN_BASE_URL}/avatars/${member.user.id}/${member.user.avatar}${extension}`;
}

export function memberToResult(member: DiscordGuildMember): MemberResult {
  return {
    id: member.user.id,
    username: member.user.username,
    displayName: member.nick || member.user.username,
    avatarUrl: buildAvatarUrl(member),
  };
}

export class GetServerMembersOutputDto {
  results: MemberResult[];
  total: number;

  static fromEntities(
    members: DiscordGuildMember[]
  ): GetServerMembersOutputDto {
    return {
      results: members.map(memberToResult),
      total: members.length,
    };
  }
}
