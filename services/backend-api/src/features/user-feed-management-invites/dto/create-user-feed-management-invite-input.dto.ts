import { IsNotEmpty, IsString } from "class-validator";

export class CreateUserFeedManagementInviteInputDto {
  @IsString()
  @IsNotEmpty()
  feedId: string;

  @IsString()
  @IsNotEmpty()
  discordUserId: string;
}
