import { DiscordGuildMember } from "../../../common";
import { DISCORD_CDN_BASE_URL } from "../../../constants/discord";

interface MemberSearchResult {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export class GetServerMembersOutputDto {
  results: MemberSearchResult[];

  total: number;

  static fromEntities(
    members: DiscordGuildMember[]
  ): GetServerMembersOutputDto {
    return {
      results: members.map((member) => {
        let extension = ".png";

        if (member.user.avatar?.startsWith("a_")) {
          extension = ".gif";
        }

        return {
          id: member.user.id,
          username: member.user.username,
          avatarUrl: member.user.avatar
            ? `${DISCORD_CDN_BASE_URL}/avatars/${member.user.id}/${member.user.avatar}${extension}`
            : null,
        };
      }),
      total: members.length,
    };
  }
}
