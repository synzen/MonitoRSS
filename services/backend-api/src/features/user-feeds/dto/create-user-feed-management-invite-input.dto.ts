import { IsNotEmpty, IsString } from "class-validator";

export class CreateUserFeedManagementInviteInputDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
