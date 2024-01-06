import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { UserFeedManagerInviteType } from "../constants";

class CreateUserFeedManagementInviteConnectionsInputDto {
  @IsString()
  @IsNotEmpty()
  connectionId: string;
}

export class CreateUserFeedManagementInviteInputDto {
  @IsString()
  @IsNotEmpty()
  feedId: string;

  @IsString()
  @IsNotEmpty()
  discordUserId: string;

  @IsIn(Object.values(UserFeedManagerInviteType))
  type: UserFeedManagerInviteType;

  @IsOptional()
  @Type(() => CreateUserFeedManagementInviteConnectionsInputDto)
  @ValidateNested({ each: true })
  @IsArray()
  connections?: CreateUserFeedManagementInviteConnectionsInputDto[];
}
