import { DiscordGuildMember } from "../../../common";
import { DISCORD_CDN_BASE_URL } from "../../../constants/discord";

interface MemberResult {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export class GetServerMemberOutputDto {
  result: MemberResult;

  static fromEntity(member: DiscordGuildMember): GetServerMemberOutputDto {
    let extension = ".png";

    if (member.user.avatar?.startsWith("a_")) {
      extension = ".gif";
    }

    return {
      result: {
        id: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.avatar
          ? `${DISCORD_CDN_BASE_URL}/avatars/${member.user.id}/${member.user.avatar}${extension}`
          : null,
      },
    };
  }
}
