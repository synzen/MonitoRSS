import { DiscordGuildMember } from "../../../common";

interface MemberResult {
  id: string;
  username: string;
  displayName: string;
}

export class GetServerMemberOutputDto {
  result: MemberResult;

  static fromEntity(member: DiscordGuildMember): GetServerMemberOutputDto {
    return {
      result: {
        id: member.user.id,
        username: member.user.username,
        displayName: member.nick || member.user.username,
      },
    };
  }
}
