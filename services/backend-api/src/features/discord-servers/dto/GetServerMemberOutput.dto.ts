import { DiscordGuildMember } from "../../../common";
import { MemberResult, memberToResult } from "./GetServerMembersOutput.dto";

export class GetServerMemberOutputDto {
  result: MemberResult;

  static fromEntity(member: DiscordGuildMember): GetServerMemberOutputDto {
    return {
      result: memberToResult(member),
    };
  }
}
