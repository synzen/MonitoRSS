import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { UserFeedManagerInviteType } from "../constants";

export class CreateUserFeedManagementInviteInputDto {
  @IsString()
  @IsNotEmpty()
  feedId: string;

  @IsString()
  @IsNotEmpty()
  discordUserId: string;

  @IsIn(Object.values(UserFeedManagerInviteType))
  type: UserFeedManagerInviteType;

  @IsString({ each: true })
  @IsOptional()
  @IsNotEmpty({ each: true })
  connectionIds?: string[];
}
